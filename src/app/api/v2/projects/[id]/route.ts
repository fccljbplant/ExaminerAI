/**
 * GET /api/v2/projects/[id] — L7 Project workspace (REDESIGN-P3 §L7, W10
 * audit: V1 Gantt/ProjectWeekPlan/ReportPanel re-homed)
 *
 * Learner's project: goal/stack/deadline, milestone stepper (ordered,
 * completable), week-grouped task list with status, and progress
 * rollups. IDOR: owner-only.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);

export async function GET(
  _req: NextRequest,
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

  const { id } = await params;

  const project = await db.learnProject.findFirst({
    where: { id, userId: user.sub }, // IDOR: owner-only
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  // Week-grouped tasks for this learner (course-scoped).
  const tasks = await db.projectTask.findMany({
    where: { userId: user.sub, ...(project.courseId ? { courseId: project.courseId } : {}) },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });

  const courseName = project.courseId
    ? (await db.course.findUnique({ where: { id: project.courseId }, select: { name: true } }))?.name
    : null;

  const done = project.milestones.filter((m) => m.status === "completed").length;
  const tasksDone = tasks.filter((t) => t.status === "completed").length;

  return apiSuccess({
    project: {
      id: project.id,
      title: project.title,
      goal: project.goal,
      stack: project.stack,
      currentState: project.currentState,
      deadline: project.deadline?.toISOString() ?? null,
      status: project.status,
      courseName: courseName ?? null,
      createdAt: project.createdAt.toISOString(),
    },
    milestones: project.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      status: m.status,
      completedAt: m.completedAt?.toISOString() ?? null,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.description,
      status: t.status,
      week: t.week,
      dueDate: t.dueDate,
      isMilestone: t.isMilestone,
    })),
    kpis: {
      milestoneProgress: project.milestones.length > 0 ? Math.round((done / project.milestones.length) * 100) : 0,
      milestonesDone: `${done}/${project.milestones.length}`,
      taskProgress: tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0,
      tasksDone: `${tasksDone}/${tasks.length}`,
    },
  });
}
