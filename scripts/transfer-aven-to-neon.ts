/**
 * scripts/transfer-aven-to-neon.ts — one-shot Aiven → Neon data migration.
 *
 * The current production database lives on Aiven (examiner-ai project on
 * Vercel). This script copies every table from Aiven into the Neon
 * "neondb" database so the app can move to Neon with the pooled endpoint.
 *
 * What it does:
 *   1. WIPES the Neon public schema (DROP SCHEMA public CASCADE) —
 *      run only with --yes.
 *   2. Pushes prisma/.neon-transfer.prisma (schema.prod.prisma bound to
 *      NEON_DIRECT_URL) so Neon gets the exact current schema.
 *   3. Copies every model in dependency order (parents before children,
 *      derived from the Prisma DMMF relation graph) with chunked
 *      createMany — so foreign keys never fail.
 *   4. Re-seats every Int autoincrement sequence to MAX(id).
 *   5. Verifies row counts per table against the source; exits non-zero
 *      on any mismatch.
 *
 * The local SQLite demo db (prisma/db/custom.db) is NEVER touched — demo
 * data stays in the local file, separate from the remote database.
 *
 * Run: node scripts/transfer-aven-to-neon.ts --yes
 */

try {
  process.loadEnvFile();
} catch {
  /* env already loaded */
}

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes. This WIPES the Neon 'neondb' database and replaces it with the Aiven data.");
  console.error("Run: node scripts/transfer-aven-to-neon.ts --yes");
  process.exit(1);
}

const CHUNK = 500;

const SHELL = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
const EXEC_OPTS = { shell: SHELL, stdio: "inherit" } as const;

/**
 * Build prisma/.neon-transfer.prisma from schema.prod.prisma: bind the
 * datasource to NEON_DIRECT_URL and pin the generator output to
 * node_modules/.cache/neon-client (leaves the default client untouched).
 * Regenerated on every run so it can never drift from the prod schema.
 */
function ensureTransferSchema(): string {
  const prod = readFileSync("prisma/schema.prod.prisma", "utf-8");
  const patched = prod
    .replace('url      = env("DATABASE_URL")', 'url      = env("NEON_DIRECT_URL")')
    .replace(
      /provider = "prisma-client-js"\n\}/,
      'provider = "prisma-client-js"\n  output   = "../node_modules/.cache/neon-client"\n}',
    );
  const path = "prisma/.neon-transfer.prisma";
  writeFileSync(path, patched);
  return path;
}

/** Load the cached Postgres client, generating it first if missing. */
function loadNeonClientMod() {
  try {
    return require("../node_modules/.cache/neon-client");
  } catch {
    console.log("Neon client missing — generating it now...");
    execSync("npx prisma generate --schema=prisma/.neon-transfer.prisma", EXEC_OPTS);
    return require("../node_modules/.cache/neon-client");
  }
}

/** Optional --sync-aven-schema: push the current prod schema to Aiven
 *  first (additive — adds any columns added since Aiven's last deploy). */
function syncAvenSchema() {
  const prod = readFileSync("prisma/schema.prod.prisma", "utf-8");
  const patched = prod
    .replace('url      = env("DATABASE_URL")', 'url      = env("AVEN_DIRECT_URL")')
    .replace(
      /provider = "prisma-client-js"\n\}/,
      'provider = "prisma-client-js"\n  output   = "../node_modules/.cache/neon-client"\n}',
    );
  writeFileSync("prisma/.aven-push.prisma", patched);
  console.log("Syncing Aiven schema to schema.prod.prisma (additive)...");
  // --accept-data-loss: dropping ProjectWeek's old unique index
  // (userId, weekNumber) for the project-scoped one is safe — the old
  // constraint already guaranteed no duplicates and legacy rows have
  // projectId = NULL (distinct in PG15+).
  execSync("npx prisma db push --schema=prisma/.aven-push.prisma --skip-generate --accept-data-loss", EXEC_OPTS);
}

interface DmmfModel {
  name: string;
  dbName: string | null;
  fields: Array<{
    name: string;
    kind: string;
    type: string;
    isId?: boolean;
    hasDefaultValue?: boolean;
    dbName?: string | null;
    relationFromFields?: string[];
    default?: { name?: string } | null;
  }>;
}

function topoOrder(models: DmmfModel[]): string[] {
  const names = models.map((m) => m.name);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  names.forEach((n) => {
    indeg.set(n, 0);
    adj.set(n, []);
  });
  for (const m of models) {
    for (const f of m.fields) {
      if (
        f.kind === "object" &&
        f.relationFromFields &&
        f.relationFromFields.length > 0 &&
        f.type !== m.name &&
        indeg.has(f.type)
      ) {
        // m holds a FK to f.type → f.type must be inserted first.
        adj.get(f.type)!.push(m.name);
        indeg.set(m.name, (indeg.get(m.name) || 0) + 1);
      }
    }
  }
  const queue = names.filter((n) => indeg.get(n) === 0);
  const out: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const c of adj.get(n)!) {
      indeg.set(c, indeg.get(c)! - 1);
      if (indeg.get(c) === 0) queue.push(c);
    }
  }
  if (out.length !== names.length) {
    console.warn("WARN: relation cycle detected — appending unresolved models in schema order");
    for (const n of names) if (!out.includes(n)) out.push(n);
  }
  return out;
}

async function main() {
  if (process.argv.includes("--sync-aven-schema")) syncAvenSchema();
  ensureTransferSchema();
  const mod = loadNeonClientMod();
  const { PrismaClient, Prisma } = mod as {
    PrismaClient: new (opts: { datasourceUrl: string }) => any;
    Prisma: { dmmf: { datamodel: { models: DmmfModel[] } } };
  };

  const avenUrl = process.env.AVEN_DIRECT_URL;
  const neonUrl = process.env.NEON_DIRECT_URL;
  if (!avenUrl || !neonUrl) {
    console.error("AVEN_DIRECT_URL / NEON_DIRECT_URL missing from .env");
    process.exit(1);
  }

  const models: DmmfModel[] = Prisma.dmmf.datamodel.models;
  console.log(`Schema models: ${models.length}`);
  console.log(`Source: ${avenUrl.replace(/:[^@/]+@/, ":****@")}`);
  console.log(`Target: ${neonUrl.replace(/:[^@/]+@/, ":****@")}`);
  console.log("");

  const src = new PrismaClient({ datasourceUrl: avenUrl });
  const dst = new PrismaClient({ datasourceUrl: neonUrl });

  const totalStart = Date.now();
  try {
    // 1 ── Wipe Neon
    console.log("── 1. Wiping Neon public schema ──");
    await dst.$executeRawUnsafe("DROP SCHEMA public CASCADE");
    await dst.$executeRawUnsafe("CREATE SCHEMA public");
    console.log("Neon schema wiped.");

    // 2 ── Push current schema
    console.log("\n── 2. Pushing current schema to Neon ──");
    execSync("npx prisma db push --schema=prisma/.neon-transfer.prisma --skip-generate", EXEC_OPTS);

    // 3 ── Copy in dependency order
    console.log("\n── 3. Copying data Aiven → Neon (dependency order) ──");
    const order = topoOrder(models);
    const modelByName = new Map(models.map((m) => [m.name, m]));
    const copied: Record<string, number> = {};
    for (const name of order) {
      const m = modelByName.get(name)!;
      const table = m.dbName || m.name;
      const t0 = Date.now();
      const rows = await src[name].findMany();
      copied[name] = rows.length;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await dst[name].createMany({ data: rows.slice(i, i + CHUNK) });
      }
      console.log(`  ${table.padEnd(30)} ${String(rows.length).padStart(6)} rows   ${Date.now() - t0}ms`);
    }

    // 4 ── Re-seat autoincrement sequences
    console.log("\n── 4. Re-seating autoincrement sequences ──");
    for (const m of models) {
      for (const f of m.fields) {
        if (
          f.kind === "scalar" &&
          f.isId &&
          f.type === "Int" &&
          f.hasDefaultValue &&
          f.default &&
          f.default.name === "autoincrement"
        ) {
          const table = m.dbName || m.name;
          const col = f.dbName || f.name;
          await dst.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE((SELECT MAX("${col}") FROM "${table}"), 1), true)`,
          );
          console.log(`  ${table}.${col} sequence re-seated`);
        }
      }
    }

    // 5 ── Verify counts
    console.log("\n── 5. Verifying row counts ──");
    let mismatches = 0;
    let totalRows = 0;
    for (const m of models) {
      const table = m.dbName || m.name;
      const a = await src.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`);
      const b = await dst.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`);
      totalRows += Number(b[0].n);
      if (Number(a[0].n) !== Number(b[0].n)) {
        mismatches++;
        console.error(`  MISMATCH ${table}: aiven=${a[0].n} neon=${b[0].n}`);
      }
    }
    const secs = ((Date.now() - totalStart) / 1000).toFixed(1);
    if (mismatches === 0) {
      console.log(`\n✓ TRANSFER COMPLETE — ${totalRows} rows across ${models.length} tables in ${secs}s, all counts match.`);
    } else {
      console.error(`\n✗ TRANSFER FAILED — ${mismatches} table(s) have mismatched counts.`);
      process.exitCode = 1;
    }
  } finally {
    await src.$disconnect();
    await dst.$disconnect();
  }
}

main();
