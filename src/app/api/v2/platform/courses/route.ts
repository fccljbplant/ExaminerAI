/**
 * GET /api/v2/platform/courses — course management list (W16: V1
 * CourseManagementPanel restored on the v2 stack)
 * PATCH /api/v2/platform/courses/[id] — publish / feature / activate
 *
 * Platform admin only. Writes are audited.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import { getCourseManagement } from "@/modules/platform-portal/lib/platform-db";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized(), user: null };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403), user: null };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403), user: null };
  }
  return { denied: null, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.denied) return auth.denied;

  const courses = await getCourseManagement();
  return apiSuccess({ courses });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.denied || !auth.user) return auth.denied;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    published?: boolean;
    featured?: boolean;
    isActive?: boolean;
  };
  if (!body.id) return apiError("Course id required", "VALIDATION_ERROR", 400);

  const course = await db.course.findUnique({ where: { id: body.id }, select: { id: true, name: true } });
  if (!course) return apiError("Course not found", "NOT_FOUND", 404);

  const data: Record<string, boolean> = {};
  if (body.published !== undefined) data.published = body.published;
  if (body.featured !== undefined) data.featured = body.featured;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (Object.keys(data).length === 0) {
    return apiError("Nothing to update", "VALIDATION_ERROR", 400);
  }

  const updated = await db.course.update({ where: { id: body.id }, data });

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "course_updated",
    target: { type: "Course", id: course.id },
    metadata: { changes: data, courseName: course.name },
  });

  return apiSuccess({ id: updated.id, published: updated.published, featured: updated.featured, isActive: updated.isActive });
}
