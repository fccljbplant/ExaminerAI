/**
 * scripts/purge-demo-accounts.ts — remove ALL demo accounts from a remote
 * Postgres database (Aiven today, Neon after cutover).
 *
 * Demo data must live ONLY in the local SQLite file (prisma/db/custom.db).
 * This script deletes every User row whose email ends with @demo.ai plus
 * every row that references those users (discovered from the Prisma DMMF —
 * any model with a userId foreign key), so nothing dangles.
 *
 * Targets AVEN_DIRECT_URL by default; override with DATABASE_TARGET_URL.
 *
 * Run: node scripts/purge-demo-accounts.ts --yes
 */

try {
  process.loadEnvFile();
} catch {
  /* env already loaded */
}

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes. This DELETES demo accounts and their data from the remote database.");
  console.error("Run: node scripts/purge-demo-accounts.ts --yes");
  process.exit(1);
}

const DEMO_SUFFIX = "@demo.ai";

async function main() {
  const mod = require("../node_modules/.cache/neon-client");
  const { PrismaClient, Prisma } = mod as {
    PrismaClient: new (opts: { datasourceUrl: string }) => any;
    Prisma: { dmmf: { datamodel: { models: any[] } } };
  };

  const targetUrl = process.env.DATABASE_TARGET_URL || process.env.AVEN_DIRECT_URL;
  if (!targetUrl) {
    console.error("AVEN_DIRECT_URL (or DATABASE_TARGET_URL) missing from .env");
    process.exit(1);
  }
  if (targetUrl.includes("file:")) {
    console.error("Refusing to purge a local SQLite db — demo data lives locally by design.");
    process.exit(1);
  }

  const db = new PrismaClient({ datasourceUrl: targetUrl });
  try {
    const demoUsers = await db.$queryRawUnsafe(
      `SELECT id, email, role FROM "User" WHERE email LIKE '%${DEMO_SUFFIX}'`,
    );
    if (demoUsers.length === 0) {
      console.log("✓ No demo accounts in the remote database — nothing to do.");
      return;
    }

    const ids: string[] = demoUsers.map((u: any) => u.id);
    console.log(`Found ${ids.length} demo accounts:`);
    for (const u of demoUsers) console.log(`  ${u.email} (${u.role})`);
    console.log(`\nPurging their data across all referencing tables...`);

    // Every model with a userId FK (regardless of cascade) — delete
    // referencing rows first so no orphans remain.
    const models = Prisma.dmmf.datamodel.models as any[];
    let totalDeleted = 0;
    for (const m of models) {
      const hasUserIdFk = (m.fields ?? []).some(
        (f: any) =>
          f.kind === "scalar" &&
          f.name === "userId" &&
          (m.fields ?? []).some((r: any) => r.kind === "object" && r.relationFromFields?.includes("userId")),
      );
      if (!hasUserIdFk) continue;
      const table = m.dbName || m.name;
      const res = await db[m.name].deleteMany({ where: { userId: { in: ids } } });
      if (res.count > 0) {
        console.log(`  ${table}: -${res.count} rows`);
        totalDeleted += res.count;
      }
    }

    const userRes = await db.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`  User: -${userRes.count} accounts`);
    totalDeleted += userRes.count;

    const remaining = await db.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "User" WHERE email LIKE '%${DEMO_SUFFIX}'`,
    );
    if (remaining[0].n > 0) {
      console.error(`✗ PURGE INCOMPLETE — ${remaining[0].n} demo accounts remain.`);
      process.exitCode = 1;
    } else {
      console.log(`\n✓ PURGE COMPLETE — ${totalDeleted} rows removed, zero demo accounts remain.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main();
