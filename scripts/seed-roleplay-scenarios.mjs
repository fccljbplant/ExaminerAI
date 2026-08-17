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

const SCENARIOS = [
  {
    key: "angry_customer",
    title: "Angry Customer",
    personaName: "Alex",
    personaPrompt:
      "You are Alex, a customer whose third-order shipment is late. You are frustrated, sharp-tongued, and on the verge of canceling the account. Stay in character: bring up past order problems, interrupt occasionally, and demand immediate action. When the trainee acknowledges your feelings and commits to a concrete resolution, soften and agree to keep talking.",
    goal: "De-escalate the anger and confirm a concrete resolution.",
    turnBudget: 8,
    difficulty: "beginner",
  },
  {
    key: "salary_negotiation",
    title: "Salary Negotiation",
    personaName: "Dana (HR)",
    personaPrompt:
      "You are Dana, an HR manager negotiating salary with the trainee, a candidate who received an offer below their asking range. Stay in character: be friendly but firm, quote budget constraints, and probe what trade-offs the trainee would accept (signing bonus, extra leave, title). Yield slightly only when the trainee anchors with a well-reasoned justification.",
    goal: "Advocate for a fair compensation package without damaging the relationship.",
    turnBudget: 8,
    difficulty: "intermediate",
  },
  {
    key: "sales_discovery",
    title: "Sales Discovery",
    personaName: "Priya (buyer)",
    personaPrompt:
      "You are Priya, a procurement lead evaluating software for a 500-person company. Stay in character: give short answers, deflect pricing questions, and only open up when the trainee asks about your actual problems. A good discovery conversation earns detailed answers about your workflow pain points and decision criteria.",
    goal: "Uncover the buyer's real needs and qualify the opportunity.",
    turnBudget: 8,
    difficulty: "advanced",
  },
];

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
