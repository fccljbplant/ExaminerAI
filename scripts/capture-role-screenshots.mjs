import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const origin = "http://127.0.0.1:3102";
const debug = "http://127.0.0.1:9222";
const out = join(process.cwd(), "artifacts", "role-screenshots");
const fixtures = [
  ["learner", "learner", "/learner"],
  ["instructor", "instructor", "/instructor"],
  ["org_admin", "org", "/org"],
  ["platform_admin", "platform", "/platform"],
];
const viewports = [
  [360, 800], [390, 844], [768, 1024], [1024, 768],
  [1366, 768], [1920, 1080], [2560, 1440],
];
const chromePath = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
  .find(existsSync);
if (!chromePath) throw new Error("Google Chrome/Chromium missing on CI runner.");
if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) throw new Error("CI DB/JWT secrets missing.");

const users = [];
let org;
try {
  await mkdir(out, { recursive: true });
  await prisma.$connect();
  org = await prisma.organization.create({ data: { name: "UX Screenshot Org", slug: "ux-screenshot-ci" } });
  for (const [role, flag, path] of fixtures) {
    const email = `ux-ci-${role}@example.invalid`;
    const user = await prisma.user.create({
      data: { email, name: `UX CI ${role}`, passwordHash: "unused-ci-hash", role, status: "active", approvedAt: new Date() },
    });
    users.push({ role, path, token: jwt.sign({ sub: user.id, email, role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "4h" }) });
    const key = `feature_portal_${flag}_v2`;
    await prisma.setting.upsert({ where: { key }, update: { value: "true" }, create: { key, value: "true" } });
  }
  const orgAdmin = await prisma.user.findUnique({ where: { email: "ux-ci-org_admin@example.invalid" } });
  await prisma.orgMember.create({ data: { orgId: org.id, userId: orgAdmin.id, role: "admin", status: "active" } });
} finally {
  await prisma.$disconnect();
}

const profile = await mkdtemp(join(tmpdir(), "ux-ci-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=9222", "--remote-allow-origins=*",
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", e => {
      const m = JSON.parse(String(e.data)), p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result || {});
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }
      }, 15000).unref();
    });
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let version;
  for (let i = 0; i < 60; i++) {
    try { version = await (await fetch(`${debug}/json/version`)).json(); break; } catch { await sleep(500); }
  }
  if (!version) throw new Error("Chrome DevTools did not start.");
  const targets = await (await fetch(`${debug}/json/list`)).json();
  const target = targets.find(t => t.type === "page");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");
  const records = [];
  for (const user of users) for (const [width, height] of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 768 });
    await cdp.send("Network.setCookie", { name: "examiner_token", value: user.token, url: origin, httpOnly: true, sameSite: "Lax" });
    await cdp.send("Page.navigate", { url: origin + user.path });
    let state;
    for (let i = 0; i < 50; i++) {
      try {
        const result = await cdp.send("Runtime.evaluate", {
          expression: "({ready:document.readyState,path:location.pathname,title:document.title,text:(document.body?.innerText||'').trim().slice(0,2000),width:document.documentElement.scrollWidth})",
          returnByValue: true,
        });
        state = result.result.value;
        if (state?.ready === "complete") break;
      } catch {
        // Navigation may replace the execution context; retry after the document loads.
      }
      await sleep(200);
    }
    await sleep(700);
    if (state.path !== user.path || state.text.length < 10) throw new Error(`${user.role} did not render at ${user.path}; current route ${state.path}`);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const name = `${user.role}-${width}x${height}.png`;
    await writeFile(join(out, name), Buffer.from(shot.data, "base64"));
    records.push({ role: user.role, route: user.path, viewport: `${width}x${height}`, title: state.title, documentWidth: state.width, horizontalOverflow: state.width > width + 1, screenshot: name });
    console.log(`Captured ${name}`);
  }
  await writeFile(join(out, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), note: "Synthetic CI users and isolated SQLite only; screenshots are viewport captures.", records }, null, 2));
  cdp.ws.close();
  const overflowing = records.filter(r => r.horizontalOverflow);
  if (overflowing.length) console.warn(`Horizontal overflow detected in ${overflowing.length} role/viewport screenshots; see manifest.`);
} finally {
  chrome.kill("SIGTERM");
  await sleep(500);
  await rm(profile, { recursive: true, force: true });
}
