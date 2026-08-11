/**
 * POST /api/learn/sessions?courseId=...&slideId=...
 *
 * Create-or-get an active TutorSession for the authed user + course +
 * (optional) current slide. The LearnShell calls this on mount to get
 * a sessionId it can use for the chat pane.
 *
 * Returns: { sessionId, status, language, teachingLevel }
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const slideId = url.searchParams.get("slideId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const profile = await getOrCreateProfile(user.sub, courseId);

  // Try to reuse an existing active session for this course+slide.
  const existing = await db.tutorSession.findFirst({
    where: { userId: user.sub, courseId, status: "active", ...(slideId ? { slideId } : { slideId: null }) },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    return apiSuccess({
      sessionId: existing.id,
      status: existing.status,
      language: existing.language,
      teachingLevel: existing.teachingLevel,
    });
  }

  const session = await db.tutorSession.create({
    data: {
      userId: user.sub,
      courseId,
      slideId: slideId ?? null,
      status: "active",
      language: profile.preferredLanguage,
      teachingLevel: profile.teachingLevel,
    },
  });

  return apiSuccess({
    sessionId: session.id,
    status: session.status,
    language: session.language,
    teachingLevel: session.teachingLevel,
  });
}

/**
 * GET /api/learn/sessions?courseId=...
 *
 * List all active sessions for the authed user + course.
 */
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const sessions = await db.tutorSession.findMany({
    where: { userId: user.sub, courseId },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      slideId: true,
      language: true,
      teachingLevel: true,
      startedAt: true,
      endedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return apiSuccess({ sessions });
}
