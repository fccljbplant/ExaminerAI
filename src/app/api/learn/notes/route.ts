/**
 * /api/learn/notes
 *
 * GET  ?courseId=...&slideId=...   — list notes (optionally filtered)
 * POST { courseId, slideId?, content } — create a note
 *
 * Notes are short markdown jots the learner takes while viewing a slide.
 * They're scoped per (userId, courseId, slideId?).
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const slideId = url.searchParams.get("slideId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const notes = await db.learnNote.findMany({
    where: { userId: user.sub, courseId, ...(slideId ? { slideId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return apiSuccess({ notes });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  let body: { courseId?: string; slideId?: string; content?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const { courseId, slideId, content } = body;
  if (!courseId) return apiValidationError({ courseId: "courseId is required" });
  if (!content || !content.trim()) return apiValidationError({ content: "content is required" });
  if (content.length > 10000) return apiValidationError({ content: "content too long (10000 char max)" });

  const note = await db.learnNote.create({
    data: {
      userId: user.sub,
      courseId,
      slideId: slideId ?? null,
      content: content.trim(),
    },
  });

  return apiSuccess({ note });
}
