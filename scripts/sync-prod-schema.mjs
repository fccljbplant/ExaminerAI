/**
 * scripts/sync-prod-schema.mjs — apply the additive SaaS schema to the
 * production Postgres database safely (2026-08-17).
 *
 * WHY: the Vercel build's `prisma db push` runs against the POOLED
 * DATABASE_URL, which can refuse DDL — leaving the prod DB without the
 * new tables while the new client expects them. This script pushes via
 * the DIRECT (non-pooled) connection, exactly like the proven Aiven→Neon
 * transfer tooling.
 *
 * SAFETY:
 *   - refuses to run without --yes
 *   - requires PROD_DIRECT_URL (or NEON_DIRECT_URL) env
 *   - runs `prisma db push` WITHOUT --accept-data-loss — an additive
 *     push succeeds; any destructive change fails loudly
 *   - prints which of the new SaaS tables exist afterwards
 *
 * Run: PROD_DIRECT_URL=postgresql://… node scripts/sync-prod-schema.mjs --yes
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile();
} catch {
  /* env already loaded */
}

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes. This applies schema changes to PRODUCTION.");
  console.error("Run: PROD_DIRECT_URL=postgresql://… node scripts/sync-prod-schema.mjs --yes");
  process.exit(1);
}

const directUrl = process.env.PROD_DIRECT_URL || process.env.NEON_DIRECT_URL;
if (!directUrl) {
  console.error("PROD_DIRECT_URL (or NEON_DIRECT_URL) is not set — a direct, non-pooled connection is required for DDL.");
  process.exit(1);
}

// Bind the prod schema to the direct URL in a temp schema file so the
// main client generation is untouched (same pattern as the Aiven→Neon
// transfer tooling).
const prod = readFileSync("prisma/schema.prod.prisma", "utf-8");
const patched = prod.replace(
  'url      = env("DATABASE_URL")',
  'url      = env("PROD_DIRECT_URL")',
);
const tmpSchema = "prisma/.prod-direct.prisma";
writeFileSync(tmpSchema, patched);

console.log("Pushing schema to production via direct connection (additive only — no --accept-data-loss)...");
try {
  execSync("npx prisma db push --schema=prisma/.prod-direct.prisma --skip-generate", {
    stdio: "inherit",
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
  });
} catch (err) {
  console.error("\n✖ Schema push FAILED. If prisma reported a destructive change, fix the schema first — never add --accept-data-loss.");
  process.exit(1);
}

console.log("✓ Schema synced. Verifying the new SaaS tables exist...");
const verify = execSync(
  `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient({ datasourceUrl: process.env.PROD_DIRECT_URL }); const tables = ['Coupon','Payout','Department','DepartmentCourse','Subscription','OrgInvoice','Announcement','CourseMaterial','CourseEmbedding','RoleplayScenario','RoleplayRun']; const rows = await p.\\$queryRawUnsafe(\\"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY(\\$1)\\", tables); const found = rows.map(r => r.tablename); console.log(tables.map(t => (found.includes(t) ? '✓' : '✖') + ' ' + t).join('\\n')); await p.\\$disconnect();"`,
  {
    stdio: "inherit",
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
    env: { ...process.env, PROD_DIRECT_URL: directUrl },
  },
);
console.log(verify.toString());
