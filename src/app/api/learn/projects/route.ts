/**
 * /api/learn/projects
 *
 * GET  — list the authed user's learn projects (optionally filtered by ?courseId=).
 * POST — create a new project with default milestones. Body:
 *   { courseId?, title, goal?, stack?, currentState?, deadline? }
 *
 * If `courseId` is provided and an active project already exists for
 * (userId, courseId), the existing project is returned (idempotent).
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";
import { apiError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";

export const runtime = "nodejs";

const DEFAULT_MILESTONES = [
  { title: "Plan & design", description: "Define project goals, scope, and architecture.", order: 0 },
  { title: "Build core features", description: "Implement the minimum-viable version of the main feature set.", order: 1 },
  { title: "Integrate & test", description: "Wire everything together and run end-to-end tests.", order: 2 },
  { title: "Polish & ship", description: "Final UX polish, documentation, and deployment.", order: 3 },
];

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");

  const [projects, enrollments] = await Promise.all([
    db.learnProject.findMany({
      where: { userId: user.sub, ...(courseId ? { courseId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        milestones: { orderBy: { order: "asc" } },
        tasks: { select: { id: true, status: true } },
      },
    }),
    db.courseEnrollment.findMany({
      where: { userId: user.sub, role: "student" },
      select: { courseId: true, course: { select: { id: true, name: true } } },
    }),
  ]);

  return apiSuccess({
    projects: projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "completed").length;
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        status: p.status,
        durationWeeks: p.durationWeeks,
        deadline: p.deadline?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        milestones: p.milestones,
        kpis: {
          taskProgress: total > 0 ? Math.round((done / total) * 100) : 0,
          tasksDone: `${done}/${total}`,
        },
      };
    }),
    // Enrolled courses — used by the new-project form's course picker.
    courses: enrollments.map((e) => ({ id: e.course.id, name: e.course.name })),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const demoBlock = await demoWriteBlock("creating a project");
  if (demoBlock) return demoBlock;

  let body: {
    courseId?: string;
    title?: string;
    goal?: string;
    stack?: string;
    currentState?: string;
    deadline?: string;
    description?: string;
    objectives?: string[];
    durationWeeks?: number;
  } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  if (!body.title || !body.title.trim()) return apiValidationError({ title: "title is required" });

  // Idempotent on (userId, courseId) when courseId is provided: pending,
  // approved AND rejected projects all count as "in flight" — a rejected
  // proposal is edited and resubmitted, never silently duplicated.
  if (body.courseId) {
    const existing = await db.learnProject.findFirst({
      where: {
        userId: user.sub,
        courseId: body.courseId,
        status: { in: ["pending_approval", "approved", "rejected"] },
      },
      include: { milestones: { orderBy: { order: "asc" } } },
    });
    if (existing) return apiSuccess({ project: existing, alreadyExisted: true });
  }

  const project = await db.learnProject.create({
    data: {
      userId: user.sub,
      courseId: body.courseId ?? null,
      title: body.title.trim(),
      goal: body.goal ?? null,
      stack: body.stack ?? null,
      currentState: body.currentState ?? null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      description: body.description?.trim() || null,
      objectives: Array.isArray(body.objectives)
        ? JSON.stringify(body.objectives.map(String).filter(Boolean))
        : null,
      durationWeeks: Math.min(Math.max(Math.round(Number(body.durationWeeks) || 4), 2), 26),
      // v2 project flow: new projects start unapproved — task generation
      // stays locked until the instructor approves the proposal.
      status: "pending_approval",
      milestones: { create: DEFAULT_MILESTONES },
    },
    include: { milestones: { orderBy: { order: "asc" } } },
  });

  // Alert the course instructors so the proposal actually gets reviewed.
  if (body.courseId) {
    try {
      const instructors = await db.courseEnrollment.findMany({
        where: { courseId: body.courseId, role: "instructor" },
        select: { userId: true },
      });
      if (instructors.length > 0) {
        await db.notification.createMany({
          data: instructors.map((i) => ({
            userId: i.userId,
            type: "project_submitted",
            title: "New project proposal",
            body: `"${project.title}" is awaiting your approval.`,
            link: `/instructor/students/${user.sub}`,
          })),
        });
      }
    } catch (err) {
      logger.warn("failed to notify instructors of project submission", { err });
    }
  }

  return apiSuccess({ project, alreadyExisted: false });
}
