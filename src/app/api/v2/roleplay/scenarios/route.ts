/**
 * GET /api/v2/roleplay/scenarios — published roleplay scenarios.
 *
 * Available to any authenticated user (learner role included). Returns
 * the compact scenario cards: id, key, title, personaName, goal,
 * turnBudget, difficulty.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const scenarios = await db.roleplayScenario.findMany({
    where: { published: true },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess({
    scenarios: scenarios.map((s) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      personaName: s.personaName,
      goal: s.goal,
      turnBudget: s.turnBudget,
      difficulty: s.difficulty,
    })),
  });
}
