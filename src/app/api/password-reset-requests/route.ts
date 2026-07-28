import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/password-reset-requests
 *
 * List password reset requests. Admins see all, teachers see for their students.
 * Query: ?status=pending|approved|resolved|rejected
 */
export async function GET(req: Request) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  // M2-security: teachers/TAs only see reset requests for their students.
  // Admins see all requests.
  let userFilter: Record<string, unknown> = {};
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    const courseIds = instructorCourses.map(c => c.courseId);
    let studentIds: string[] = [];
    if (courseIds.length > 0) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: courseIds }, role: "student" },
        select: { userId: true },
      });
      studentIds = enrollments.map(e => e.userId);
    }
    userFilter = { user: { id: { in: studentIds.length > 0 ? studentIds : ["none"] } } };
  }

  const requests = await db.passwordResetRequest.findMany({
    where: { ...(status === "all" ? {} : { status }), ...userFilter },
    take: 100,
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
