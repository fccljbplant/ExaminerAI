import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, relative } from "node:path";

const root = process.cwd();
const appRoot = join(root, "src", "app");
const port = Number(process.env.SMOKE_PORT || 3101);
const origin = `http://127.0.0.1:${port}`;
const pageFiles = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);

function toRouteSegment(segment) {
  if (segment.startsWith("[[...") && segment.endsWith("]]")) return "smoke-test";
  if (segment.startsWith("[...") && segment.endsWith("]")) return "smoke-test";
  if (segment.startsWith("[") && segment.endsWith("]")) return "smoke-test";
  return segment;
}

async function collectPages(directory, segments = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isFile() && pageFiles.has(entry.name)) {
      const pathname = "/" + segments.map(toRouteSegment).filter(Boolean).join("/");
      found.push({
        pathname: pathname === "/" ? "/" : pathname.replace(/\/$/, ""),
        source: relative(root, fullPath),
        dynamic: segments.some((segment) => segment.startsWith("[")),
      });
      continue;
    }
    if (!entry.isDirectory()) continue;
    // Route groups, private folders, parallel slots, and intercepting routes
    // do not represent independently crawlable public URL segments.
    if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
    if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
      found.push(...await collectPages(fullPath, segments));
      continue;
    }
    if (entry.name.startsWith("(")) continue;
    found.push(...await collectPages(fullPath, [...segments, entry.name]));
  }
  return found;
}

const pages = await collectPages(appRoot);
const uniquePages = [...new Map(pages.map((page) => [page.pathname, page])).values()]
  .sort((a, b) => a.pathname.localeCompare(b.pathname));
if (uniquePages.length === 0) throw new Error("No app page routes were discovered under src/app.");

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => { serverLog = (serverLog + chunk).slice(-12000); });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js server exited early (code ${server.exitCode}).\n${serverLog}`);
    try {
      const response = await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(3000) });
      if (response.status < 500) { ready = true; break; }
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  if (!ready) throw new Error(`Next.js server did not become ready.\n${serverLog}`);

  const results = [];
  const concurrency = 8;
  for (let i = 0; i < uniquePages.length; i += concurrency) {
    const batch = uniquePages.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (page) => {
      try {
        const response = await fetch(new URL(page.pathname, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          headers: { "user-agent": "ExaminerAI-route-smoke/1.0" },
        });
        return { ...page, status: response.status };
      } catch (error) {
        return { ...page, status: 0, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    results.push(...batchResults);
  }

  const failures = results.filter((result) =>
    result.status === 0 || result.status >= 500 || (result.status === 404 && !result.dynamic)
  );
  const counts = results.reduce((acc, result) => {
    const key = String(result.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log(`Route smoke test: ${results.length}/${uniquePages.length} page routes requested.`);
  console.log(`HTTP status counts: ${Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(", ")}`);
  if (failures.length) {
    console.error("Routes needing investigation:");
    for (const failure of failures) {
      console.error(`- ${failure.pathname} [${failure.source}] -> ${failure.status} ${failure.error || ""}`);
    }
    console.error(serverLog);
    process.exitCode = 1;
  } else {
    console.log("No server-error responses or missing static page routes detected.");
  }
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), sleep(3000)]);
}
