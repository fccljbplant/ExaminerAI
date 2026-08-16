/**
 * /api/v2/projects/[id] — L7 Project workspace (v2 project flow)
 *
 * GET   — full project picture: proposal + approval state, milestones,
 *         project-scoped weeks + tasks (falls back to legacy user-level
 *         rows when the project has no generated timeline yet), KPIs.
 * PATCH — owner edits the project: title/goal/stack/currentState/deadline
 *         always editable; proposal fields (description/objectives/
 *         durationWeeks) editable while pending_approval or rejected.
 *         Editing a rejected proposal resubmits it (back to
 *         pending_approval).
 *
 * IDOR: owner-only for the learner.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, apiValidationError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);

function parseObjectives(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
}

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
    include: { milestones: { orderBy: { order: "asc" } } },
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const [projectTasks, legacyTasks, projectWeeks, legacyWeeks, approver, courseName] =
    await Promise.all([
      db.projectTask.findMany({
        where: { projectId: project.id },
        orderBy: [{ week: "asc" }, { day: "asc" }, { createdAt: "asc" }],
      }),
      db.projectTask.findMany({
        where: { userId: user.sub, ...(project.courseId ? { courseId: project.courseId } : {}), projectId: null },
        orderBy: [{ week: "asc" }, { createdAt: "asc" }],
      }),
      db.projectWeek.findMany({
        where: { projectId: project.id },
        orderBy: { weekNumber: "asc" },
      }),
      db.projectWeek.findMany({
        where: { userId: user.sub, projectId: null },
        orderBy: { weekNumber: "asc" },
      }),
      project.approvedById
        ? db.user.findUnique({ where: { id: project.approvedById }, select: { name: true } })
        : null,
      project.courseId
        ? db.course.findUnique({ where: { id: project.courseId }, select: { name: true } })
        : null,
    ]);

  const weeks = projectWeeks.length > 0 ? projectWeeks : legacyWeeks;
  const tasks = projectTasks.length > 0 ? projectTasks : legacyTasks;

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
      description: project.description,
      objectives: parseObjectives(project.objectives),
      durationWeeks: project.durationWeeks,
      approvalNote: project.approvalNote,
      approvedByName: approver?.name ?? null,
      approvedAt: project.approvedAt?.toISOString() ?? null,
      courseName: courseName?.name ?? null,
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
    weeks: weeks.map((w) => {
      let milestoneList: string[] = [];
      try {
        milestoneList = JSON.parse(w.milestones || "[]");
      } catch {
        milestoneList = [];
      }
      return {
        id: w.id,
        week: w.weekNumber,
        title: w.title,
        summary: w.summary,
        milestones: milestoneList,
      };
    }),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.description,
      status: t.status,
      week: t.week,
      day: t.day,
      dueDate: t.dueDate,
      isMilestone: t.isMilestone,
      courseTopicLink: t.taskNotes,
    })),
    kpis: {
      milestoneProgress: project.milestones.length > 0 ? Math.round((done / project.milestones.length) * 100) : 0,
      milestonesDone: `${done}/${project.milestones.length}`,
      taskProgress: tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0,
      tasksDone: `${tasksDone}/${tasks.length}`,
    },
  });
}

export async function PATCH(
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

  const demoBlock = await demoWriteBlock("editing a project");
  if (demoBlock) return demoBlock;

  const { id } = await params;

  const project = await db.learnProject.findFirst({
    where: { id, userId: user.sub },
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const body = await req.json().catch(() => ({}));
  const {
    title, goal, stack, currentState, deadline,
    description, objectives, durationWeeks,
  } = body as {
    title?: string; goal?: string; stack?: string; currentState?: string;
    deadline?: string | null; description?: string; objectives?: string[] | string;
    durationWeeks?: number;
  };

  const data: Record<string, unknown> = {};
  if (title !== undefined) {
    if (!String(title).trim()) return apiValidationError({ title: "title cannot be empty" });
    data.title = String(title).trim();
  }
  if (goal !== undefined) data.goal = goal ? String(goal).trim() : null;
  if (stack !== undefined) data.stack = stack ? String(stack).trim() : null;
  if (currentState !== undefined) data.currentState = currentState ? String(currentState).trim() : null;
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;

  // Proposal fields only while pending/rejected — the approved proposal
  // is what the instructor signed off on.
  const editableProposal = project.status === "pending_approval" || project.status === "rejected";
  if (editableProposal) {
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (objectives !== undefined) {
      const list = Array.isArray(objectives)
        ? objectives.map(String).filter(Boolean)
        : String(objectives).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      data.objectives = JSON.stringify(list);
    }
    if (durationWeeks !== undefined) {
      const weeks = Math.min(Math.max(Math.round(Number(durationWeeks) || 4), 2), 26);
      data.durationWeeks = weeks;
    }
    // Editing a rejected proposal resubmits it for approval.
    if (project.status === "rejected") data.status = "pending_approval";
  }

  if (Object.keys(data).length === 0) {
    return apiSuccess({ project: { id: project.id, status: project.status }, changed: false });
  }

  const updated = await db.learnProject.update({
    where: { id: project.id },
    data,
    select: { id: true, status: true, title: true, description: true, objectives: true, durationWeeks: true },
  });

  return apiSuccess({
    project: {
      id: updated.id,
      status: updated.status,
      title: updated.title,
      description: updated.description,
      objectives: parseObjectives(updated.objectives),
      durationWeeks: updated.durationWeeks,
    },
    changed: true,
  });
}
