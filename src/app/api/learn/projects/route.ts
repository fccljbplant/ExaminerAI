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

  const projects = await db.learnProject.findMany({
    where: { userId: user.sub, ...(courseId ? { courseId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
  });

  return apiSuccess({ projects });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  let body: {
    courseId?: string;
    title?: string;
    goal?: string;
    stack?: string;
    currentState?: string;
    deadline?: string;
  } = {};
  try { body = await req.json(); } catch { /* */ }
  if (!body.title || !body.title.trim()) return apiValidationError({ title: "title is required" });

  // Idempotent on (userId, courseId) when courseId is provided.
  if (body.courseId) {
    const existing = await db.learnProject.findFirst({
      where: { userId: user.sub, courseId: body.courseId, status: "active" },
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
      status: "active",
      milestones: { create: DEFAULT_MILESTONES },
    },
    include: { milestones: { orderBy: { order: "asc" } } },
  });

  return apiSuccess({ project, alreadyExisted: false });
}
