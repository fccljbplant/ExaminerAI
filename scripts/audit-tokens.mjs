#!/usr/bin/env node
/**
 * scripts/audit-tokens.mjs — token-law audit (REDESIGN-P2 §1.6, §2.1)
 *
 * Law: no literal hex/rgb/hsl colors outside modules/theme. Everything
 * must reference semantic tokens (bg-brand, text-fg, fill-chart-1 …).
 *
 * Strangulation policy: violations that existed at W0 live in
 * scripts/audit-tokens.baseline.json and are tolerated (legacy code
 * being strangled). Any NEW violation fails CI. Restyling a legacy
 * file removes its baseline entries naturally — resolved entries are
 * reported as info and can be pruned from the baseline.
 *
 * Usage:
 *   node scripts/audit-tokens.mjs            # audit (exit 1 on new violations)
 *   node scripts/audit-tokens.mjs --rebase   # rewrite baseline with current state
 *
 * A line can opt out explicitly with an `audit-tokens-ignore` comment.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const BASELINE_PATH = join(ROOT, "scripts", "audit-tokens.baseline.json");

const SCAN_EXT = new Set([".ts", ".tsx", ".css"]);
// Zones where raw colors are part of the job (tokens + brand math).
const ALLOW_PREFIXES = ["src/modules/theme"];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const FN_RE = /\b(rgba?|hsla?)\(/g;
const IGNORE_MARKER = "audit-tokens-ignore";

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function isAllowed(relPath) {
  return ALLOW_PREFIXES.some((p) => relPath === p || relPath.startsWith(p + "/"));
}

function scanFile(absPath, relPath) {
  const hits = [];
  const lines = readFileSync(absPath, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(IGNORE_MARKER)) return;
    const hexes = line.match(HEX_RE) ?? [];
    const fns = line.match(FN_RE) ?? [];
    for (const m of [...hexes, ...fns]) {
      hits.push({ key: `${relPath}:${i + 1}:${m.toLowerCase()}` });
    }
  });
  return hits;
}

function main() {
  const rebase = process.argv.includes("--rebase");

  const found = [];
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).split(/[/\\]/).join("/");
    if (!SCAN_EXT.has(rel.slice(rel.lastIndexOf(".")))) continue;
    if (isAllowed(rel)) continue;
    found.push(...scanFile(file, rel));
  }

  if (rebase) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), keys: found.map((h) => h.key).sort() }, null, 2) + "\n"
    );
    console.log(`audit-tokens: baseline rewritten with ${found.length} legacy violations.`);
    return;
  }

  const baseline = (() => {
    try {
      return new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).keys);
    } catch {
      return new Set();
    }
  })();

  const fresh = found.filter((h) => !baseline.has(h.key));
  const resolved = [...baseline].filter((k) => !found.some((h) => h.key === k));

  if (resolved.length > 0) {
    console.log(`audit-tokens: ${resolved.length} baseline violation(s) resolved — prune them with --rebase.`);
  }

  if (fresh.length > 0) {
    console.error(`audit-tokens: ${fresh.length} NEW raw color literal(s) found.`);
    console.error("Use semantic tokens (bg-brand, text-fg, fill-chart-1 …) — see modules/theme/tokens.");
    for (const h of fresh) console.error(`  ${h.key}`);
    process.exit(1);
  }

  console.log(
    `audit-tokens: OK (${found.length} legacy violation(s) baselined, 0 new).`
  );
}

main();
