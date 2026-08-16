/**
 * /api/v2/projects/[id]/tasks — project-scoped task management.
 *
 * POST   { description, week, day? }  — add a task to the project timeline
 * PATCH  { taskId, status }           — update task status
 * DELETE ?taskId=                     — delete a task
 *
 * Owner-only; every task is persisted with projectId + courseId so
 * multiple projects never mix tasks.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, apiValidationError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);
const VALID_STATUSES = new Set(["planned", "in_progress", "completed", "blocked"]);

async function loadOwnedProject(id: string, userId: string) {
  return db.learnProject.findFirst({
    where: { id, userId },
    select: { id: true, courseId: true },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) return apiError("Learner access only", "FORBIDDEN", 403);
  if (!(await isPortalEnabled("learner"))) return apiError("Learner portal is not enabled yet", "FORBIDDEN", 403);

  const demoBlock = await demoWriteBlock("adding a project task");
  if (demoBlock) return demoBlock;

  const { id } = await params;
  const project = await loadOwnedProject(id, user.sub);
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const body = await req.json().catch(() => ({}));
  const { description, week, day } = body as { description?: string; week?: number; day?: number };
  if (!description || !String(description).trim()) {
    return apiValidationError({ description: "description is required" });
  }
  const weekNum = Math.min(Math.max(Math.round(Number(week) || 1), 1), 26);
  const dayNum = day !== undefined ? Math.min(Math.max(Math.round(Number(day)), 1), 5) : null;

  const task = await db.projectTask.create({
    data: {
      userId: user.sub,
      courseId: project.courseId,
      projectId: project.id,
      description: String(description).trim(),
      status: "planned",
      week: weekNum,
      day: dayNum,
    },
  });

  return apiSuccess({
    task: {
      id: task.id,
      title: task.description,
      status: task.status,
      week: task.week,
      day: task.day,
      isMilestone: task.isMilestone,
      courseTopicLink: task.taskNotes,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) return apiError("Learner access only", "FORBIDDEN", 403);
  if (!(await isPortalEnabled("learner"))) return apiError("Learner portal is not enabled yet", "FORBIDDEN", 403);

  const demoBlock = await demoWriteBlock("updating a project task");
  if (demoBlock) return demoBlock;

  const { id } = await params;
  const project = await loadOwnedProject(id, user.sub);
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const body = await req.json().catch(() => ({}));
  const { taskId, status } = body as { taskId?: string; status?: string };
  if (!taskId) return apiValidationError({ taskId: "taskId is required" });
  if (!status || !VALID_STATUSES.has(status)) {
    return apiValidationError({ status: "status must be planned | in_progress | completed | blocked" });
  }

  const task = await db.projectTask.findFirst({ where: { id: taskId, projectId: project.id } });
  if (!task) return apiError("Task not found", "NOT_FOUND", 404);

  const updated = await db.projectTask.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "completed" ? new Date() : status === "planned" ? null : task.completedAt,
    },
  });

  if (status === "completed" && task.status !== "completed") {
    await db.engagementEvent.create({
      data: {
        userId: user.sub,
        courseId: project.courseId,
        eventType: "project.task_completed",
        metadata: { projectId: project.id, taskId },
      },
    });
  }

  return apiSuccess({
    task: { id: updated.id, status: updated.status, completedAt: updated.completedAt?.toISOString() ?? null },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) return apiError("Learner access only", "FORBIDDEN", 403);
  if (!(await isPortalEnabled("learner"))) return apiError("Learner portal is not enabled yet", "FORBIDDEN", 403);

  const demoBlock = await demoWriteBlock("deleting a project task");
  if (demoBlock) return demoBlock;

  const { id } = await params;
  const project = await loadOwnedProject(id, user.sub);
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return apiValidationError({ taskId: "taskId query param is required" });

  const task = await db.projectTask.findFirst({ where: { id: taskId, projectId: project.id } });
  if (!task) return apiError("Task not found", "NOT_FOUND", 404);

  await db.projectTask.delete({ where: { id: taskId } });
  return apiSuccess({ deleted: true });
}
