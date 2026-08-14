/**
 * POST /api/v2/projects/[id]/milestones/[mid]/complete — L7 milestone
 * completion (REDESIGN-P3 §L7; mirrors the kept v1 route semantics)
 *
 * Marks a milestone complete (idempotent), awards project XP once, and
 * logs the engagement event. Owner-only.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { awardTypedXP } from "@/modules/learn";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("learner"))) {
    return apiError("Learner portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("completing a milestone");
  if (demoBlock) return demoBlock;

  const { id, mid } = await params;

  const project = await db.learnProject.findFirst({
    where: { id, userId: user.sub }, // IDOR: owner-only
    select: { id: true, courseId: true },
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const milestone = await db.projectMilestone.findFirst({
    where: { id: mid, projectId: project.id },
  });
  if (!milestone) return apiError("Milestone not found", "NOT_FOUND", 404);

  if (milestone.status !== "completed") {
    await db.projectMilestone.update({
      where: { id: mid },
      data: { status: "completed", completedAt: new Date() },
    });
    try {
      await awardTypedXP(user.sub, "project_step", project.courseId ?? undefined, `milestone:${mid}`);
    } catch {
      // XP is best-effort
    }
    await db.engagementEvent.create({
      data: {
        userId: user.sub,
        courseId: project.courseId,
        eventType: "milestone.completed",
        metadata: { milestoneId: mid },
      },
    });
  }

  return apiSuccess({ completed: true });
}
