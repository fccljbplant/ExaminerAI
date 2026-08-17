/**
 * modules/roleplay/lib/roleplay-db.ts — roleplay data access
 * (2026-08-17). The ONLY file in the roleplay subsystem that imports db.
 */

import { db } from "@/lib/db";
import { DEFAULT_SCENARIOS } from "./scenarios";

let ensured = false;

/**
 * Lazy-seed the platform scenario library. Idempotent (upsert by key)
 * and safe to call on every scenarios request — the in-module flag
 * makes it a one-time check per process. Replaces the build-time seed
 * so deployments never depend on a build step touching the prod DB.
 */
export async function ensureRoleplayScenarios(): Promise<void> {
  if (ensured) return;
  try {
    for (const scenario of DEFAULT_SCENARIOS) {
      const { key, ...data } = scenario;
      await db.roleplayScenario.upsert({
        where: { key },
        update: data,
        create: { key, ...data, published: true },
      });
    }
    ensured = true;
  } catch {
    // Fails open — the scenario list simply stays empty this request
    // (a schema-not-ready prod DB must never break the route).
  }
}

export async function listPublishedScenarios() {
  await ensureRoleplayScenarios();
  const scenarios = await db.roleplayScenario.findMany({
    where: { published: true },
    orderBy: { createdAt: "asc" },
  });
  return scenarios.map((s) => ({
    id: s.id,
    key: s.key,
    title: s.title,
    personaName: s.personaName,
    goal: s.goal,
    turnBudget: s.turnBudget,
    difficulty: s.difficulty,
  }));
}
