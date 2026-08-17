/**
 * POST /api/v2/instructor/courses/[id]/reindex — rebuild the course's
 * RAG index (CourseEmbedding rows) from all sources (slides, course
 * days, narrations, materials). Powers the studio "Reindex" button.
 *
 * Instructor staff only. Returns { indexed, withEmbeddings }.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { isStaffRole } from "@/lib/rbac";
import { isPortalEnabled } from "@/lib/feature-flags";
import { indexCourse } from "@/modules/ai/lib/rag-db";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!isStaffRole(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { id: courseId } = await ctx.params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, ownerUserId: true },
  });
  if (!course) return apiNotFound("Course not found");

  // Instructors must teach the course (or own it); org/platform admins
  // manage their whole catalog.
  if (user.role === "instructor") {
    const teaches = await db.courseEnrollment.findFirst({
      where: { userId: user.sub, role: "instructor", courseId },
      select: { id: true },
    });
    if (!teaches && course.ownerUserId !== user.sub) {
      return apiError("You do not teach this course", "FORBIDDEN", 403);
    }
  }

  const result = await indexCourse(courseId);
  return apiSuccess(result);
}
