/**
 * GET /api/learn/topics?courseId=...
 *
 * Full course topic map with per-topic status (completed / current /
 * locked) — feeds the classroom topic picker + journey map. Outline-first
 * (the course's own CourseWeek/CourseDay rows), ladder fallback.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { listCourseTopics } from "@/modules/learn/lib/today-topic";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiError("Course not found", "NOT_FOUND", 404);

  const topics = await listCourseTopics(user.sub, courseId);
  if (!topics) return apiError("Not enrolled in this course", "NOT_FOUND", 404);

  return apiSuccess(topics);
}
