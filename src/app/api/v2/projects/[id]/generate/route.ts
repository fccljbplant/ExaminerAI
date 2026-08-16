/**
 * POST /api/v2/projects/[id]/generate — AI timeline + task generation.
 *
 * Approval gate: only "approved" projects (or legacy "active" ones) may
 * generate. The AI call uses feature "project-timeline" which is exempt
 * from the per-user daily AI limit.
 *
 * Body: { tasksPerWeek?: number } (default 5, max 10)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { isPortalEnabled } from "@/lib/feature-flags";
import { generateProjectTimeline } from "@/modules/project/lib/project-timeline";

export const runtime = "nodejs";
export const maxDuration = 120;

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("learner"))) {
    return apiError("Learner portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("generating a project timeline");
  if (demoBlock) return demoBlock;

  const { id } = await params;

  const project = await db.learnProject.findFirst({
    where: { id, userId: user.sub }, // IDOR: owner-only
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  // Approval gate — the core of the v2 project flow.
  if (project.status !== "approved" && project.status !== "active") {
    return apiError(
      project.status === "rejected"
        ? "This project was rejected. Edit the proposal and resubmit — generation stays locked until it's approved."
        : "Task generation unlocks after your instructor approves the project.",
      "FORBIDDEN",
      403,
    );
  }

  const body = await req.json().catch(() => ({}));
  const tasksPerWeek = body && typeof body.tasksPerWeek === "number" ? body.tasksPerWeek : undefined;

  const result = await generateProjectTimeline(
    {
      id: project.id,
      userId: project.userId,
      courseId: project.courseId,
      title: project.title,
      goal: project.goal,
      stack: project.stack,
      currentState: project.currentState,
      description: project.description,
      objectives: project.objectives,
      durationWeeks: project.durationWeeks,
    },
    { tasksPerWeek },
  );

  if (!result.ok) {
    return apiError(result.error ?? "Generation failed", "INVALID_INPUT", 400);
  }

  await db.engagementEvent.create({
    data: {
      userId: user.sub,
      courseId: project.courseId,
      eventType: "project.timeline_generated",
      metadata: { projectId: project.id, tasks: result.tasksCreated },
    },
  });

  return apiSuccess({
    ok: true,
    weeksCreated: result.weeksCreated,
    tasksCreated: result.tasksCreated,
    weeksRequested: result.weeksRequested,
    message: `Generated ${result.tasksCreated} tasks across ${result.weeksCreated} week${result.weeksCreated === 1 ? "" : "s"} — aligned with your course outline.`,
  });
}
