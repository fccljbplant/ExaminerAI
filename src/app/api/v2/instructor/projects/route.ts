/**
 * GET /api/v2/instructor/projects — project approval queue (v2 flow).
 *
 * All LearnProjects belonging to courses the caller teaches, split into:
 *   - pending:  awaiting approval (newest first)
 *   - decided:  approved / rejected / legacy active, newest first
 *
 * Each entry carries the learner + course names so the instructor can
 * review proposals straight from the queue.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const teaching = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = teaching.map((t) => t.courseId);

  const projects = await db.learnProject.findMany({
    where: courseIds.length > 0 ? { courseId: { in: courseIds } } : { id: "__none__" },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tasks: { select: { id: true, status: true } },
    },
  });

  // LearnProject.courseId is a plain string (no relation) — resolve names.
  const courseRows = await db.course.findMany({
    where: { id: { in: projects.map((p) => p.courseId).filter(Boolean) as string[] } },
    select: { id: true, name: true },
  });
  const courseNames = new Map(courseRows.map((c) => [c.id, c.name]));

  const shaped = projects.map((p) => {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.status === "completed").length;
    return {
      id: p.id,
      title: p.title,
      goal: p.goal,
      description: p.description,
      objectives: (() => {
        try {
          const parsed = JSON.parse(p.objectives ?? "[]");
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      })(),
      durationWeeks: p.durationWeeks,
      status: p.status,
      approvalNote: p.approvalNote,
      approvedAt: p.approvedAt?.toISOString() ?? null,
      deadline: p.deadline?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      learner: { id: p.user.id, name: p.user.name, email: p.user.email },
      course: { id: p.courseId, name: p.courseId ? courseNames.get(p.courseId) ?? "Course" : null },
      kpis: {
        taskProgress: total > 0 ? Math.round((done / total) * 100) : 0,
        tasksDone: `${done}/${total}`,
      },
    };
  });

  return apiSuccess({
    pending: shaped.filter((p) => p.status === "pending_approval"),
    decided: shaped.filter((p) => p.status !== "pending_approval"),
    kpis: {
      pendingCount: shaped.filter((p) => p.status === "pending_approval").length,
      totalCount: shaped.length,
    },
  });
}
