/**
 * POST /api/v2/roleplay/runs — start a new roleplay run.
 *
 * Body: { scenarioId }
 * Creates a RoleplayRun (status "in_progress", turnsJson "[]") and
 * returns the run.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";

export const runtime = "nodejs";

const BodySchema = z.object({ scenarioId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiValidationError({ scenarioId: "scenarioId is required" });
  }

  const scenario = await db.roleplayScenario.findUnique({
    where: { id: parsed.data.scenarioId },
  });
  if (!scenario || !scenario.published) return apiNotFound("Scenario not found");

  const run = await db.roleplayRun.create({
    data: {
      userId: user.sub,
      scenarioId: scenario.id,
      status: "in_progress",
      turnsJson: "[]",
    },
  });

  return apiSuccess({
    run: {
      id: run.id,
      scenarioId: run.scenarioId,
      status: run.status,
      turns: [],
      score: run.score,
      completedAt: run.completedAt,
    },
  });
}
