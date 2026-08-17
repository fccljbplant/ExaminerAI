/**
 * scripts/seed-roleplay-scenarios.mjs — seed the platform roleplay
 * scenario library for the learner Practice page.
 *
 * Idempotent: upserts 3 scenarios keyed on RoleplayScenario.key
 * ("angry_customer", "salary_negotiation", "sales_discovery") and
 * prints created/updated counts.
 *
 * Run: node scripts/seed-roleplay-scenarios.mjs
 */

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  /* env already loaded */
}

// Refuse to run against a remote database — this script writes rows.
// The --prod flag is the ONLY exception: vercel-build.sh runs it after
// generating the Postgres client against the production DATABASE_URL,
// so real users get the scenario library too.
const isProdBuild = process.argv.includes("--prod");
if (!isProdBuild && !(process.env.DATABASE_URL || "").startsWith("file:")) {
  console.error(
    "seed-roleplay-scenarios refuses to run: DATABASE_URL is not a local SQLite file. Pass --prod only from vercel-build.sh.",
  );
  process.exit(1);
}

const db = new PrismaClient();

import { DEFAULT_SCENARIOS as SCENARIOS } from "../src/modules/roleplay/lib/scenarios.ts";

let created = 0;
let updated = 0;

for (const scenario of SCENARIOS) {
  const { key, ...data } = scenario;
  const existing = await db.roleplayScenario.findUnique({ where: { key } });
  if (existing) {
    await db.roleplayScenario.update({ where: { key }, data });
    updated++;
  } else {
    await db.roleplayScenario.create({ data: { key, ...data, published: true } });
    created++;
  }
}

console.log(`roleplay scenarios seeded: ${created} created, ${updated} updated`);
await db.$disconnect();
