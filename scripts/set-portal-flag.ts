/**
 * scripts/set-portal-flag.ts — portal rollout helper (REDESIGN-P5)
 *
 * Flips a v2 portal feature flag in the Setting store. Flags fail
 * closed (absent = legacy portal), so turning one ON is an explicit
 * upsert. Org-scoped rollout: pass an org id for the third argument.
 *
 * Usage (erasable TS — Node >= 22.18 native type stripping):
 *   node scripts/set-portal-flag.ts <portal> <true|false> [orgId]
 *   node scripts/set-portal-flag.ts learner true
 *   node scripts/set-portal-flag.ts learner true org_abc123
 */

import { PrismaClient } from "@prisma/client";

const [portal, value, orgId] = process.argv.slice(2);

if (!portal || !["true", "false"].includes(value)) {
  console.error("Usage: node scripts/set-portal-flag.ts <portal> <true|false> [orgId]");
  process.exit(1);
}

try {
  process.loadEnvFile();
} catch {
  /* .env optional — DATABASE_URL may come from the environment */
}

const key = orgId
  ? `feature_portal_${portal}_v2_org:${orgId}`
  : `feature_portal_${portal}_v2`;

const db = new PrismaClient();
try {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  console.log(`✔ ${key} = ${value}`);
} finally {
  await db.$disconnect();
}
