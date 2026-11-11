#!/usr/bin/env node
/**
 * Restricted validation runner. It intentionally does not support arbitrary shell,
 * database mutation, git operations, dotenv loading, or environment-value logging.
 *
 * Usage:
 *   node scripts/agent/run-logged.mjs lint -- npm run lint
 *   node scripts/agent/run-logged.mjs typecheck -- npx tsc --noEmit
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const [label, separator, ...command] = process.argv.slice(2);
const fail = (message, code = 64) => { console.error(`run-logged: ${message}`); process.exit(code); };

if (!label || !/^[a-z0-9][a-z0-9-]{0,39}$/i.test(label)) fail("provide a short safe log label");
if (separator !== "--" || command.length === 0) fail("usage: run-logged.mjs <label> -- <approved command>");
if (!fs.existsSync(path.join(root, "package.json"))) fail("run from the repository root");
if (fs.existsSync(path.join(root, ".git"))) {
  const branch = spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" });
  if (branch.status !== 0 || branch.stdout.trim() !== "ux-audit/fix-dashboard-truthfulness-and-agent-safety")
    fail("must run on the existing authorised PR #3 branch");
}

const allowed = [
  ["npm", ["run", "lint"]], ["npm", ["run", "test"]],
  ["npm", ["run", "build"]], ["npx", ["tsc", "--noEmit"]],
  ["npx", ["eslint"]], ["npx", ["vitest"]],
  ["npx", ["prisma", "validate"]], ["npx", ["prisma", "generate"]],
  ["node", ["--check"]]
];
const ok = allowed.some(([bin, prefix]) => command[0] === bin &&
  prefix.every((part, i) => command[i + 1] === part));
if (!ok) fail("command is not on the validation allowlist");
const joined = command.join(" ").toLowerCase();
if (/(^|\s)(db:|migrate|seed|push|reset|drop|--force-reset)(\s|$)/.test(joined))
  fail("database mutation is prohibited by this runner");

const logDir = path.join(root, ".agent-logs");
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.log`);
const started = new Date().toISOString();
const result = spawnSync(command[0], command.slice(1), { cwd: root, encoding: "utf8", shell: false, stdio: ["inherit", "pipe", "pipe"] });
const output = `started=${started}\nlabel=${label}\ncommand=${command.join(" ")}\nexit=${result.status ?? 1}\n\nSTDOUT\n${result.stdout ?? ""}\nSTDERR\n${result.stderr ?? ""}`;
fs.writeFileSync(logFile, output, { mode: 0o600 });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
console.log(`run-logged: exit=${result.status ?? 1}; log=.agent-logs/${path.basename(logFile)}`);
process.exit(result.status ?? 1);
