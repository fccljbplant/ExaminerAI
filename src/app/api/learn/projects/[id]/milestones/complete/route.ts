/**
 * POST /api/learn/projects/[id]/milestones/complete
 *
 * Body: { milestoneId }
 *
 * Marks a project milestone as completed and awards 15 XP
 * (XP_AMOUNTS.project_step). Returns the updated milestone + the next
 * milestone (or null if all done).
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiError, apiForbidden, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { awardTypedXP } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  const { id: projectId } = await ctx.params;

  let body: { milestoneId?: string } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  const { milestoneId } = body;
  if (!milestoneId) return apiValidationError({ milestoneId: "milestoneId is required" });

  const project = await db.learnProject.findUnique({
    where: { id: projectId },
    include: { milestones: { orderBy: { order: "asc" } } },
  });
  if (!project) return apiNotFound("Project not found");
  if (project.userId !== user.sub) return apiForbidden("This project belongs to another user");

  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return apiNotFound("Milestone not found");
  if (milestone.status === "completed") {
    return apiSuccess({ alreadyCompleted: true, milestone, nextMilestone: null });
  }

  const updated = await db.projectMilestone.update({
    where: { id: milestoneId },
    data: { status: "completed", completedAt: new Date() },
  });

  await awardTypedXP(user.sub, "project_step", project.courseId ?? undefined, `milestone:${milestoneId}`);

  const nextMilestone = project.milestones.find((m) => m.order > milestone.order && m.status !== "completed") ?? null;

  // If this was the last milestone, mark the project complete.
  const remaining = project.milestones.filter((m) => m.id !== milestoneId && m.status !== "completed");
  if (remaining.length === 0) {
    await db.learnProject.update({ where: { id: projectId }, data: { status: "completed" } });
  }

  return apiSuccess({
    milestone: updated,
    nextMilestone,
    projectCompleted: remaining.length === 0,
  });
}
