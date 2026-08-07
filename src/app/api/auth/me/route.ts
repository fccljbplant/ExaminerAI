import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCourseInfo } from "@/lib/course-config";
import { normalizeRole } from "@/lib/rbac";

/** GET /api/auth/me — return the currently logged-in user's public profile.
 *
 *  Post-purge 2026-08: guardian role was removed (orphaned). The
 *  `linkedStudentId` field is kept in the response shape for backward compat
 *  with any frontend code that still reads it, but always returns null now.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // Normalize the role — legacy aliases like 'admin' → 'platform_admin',
  // 'student' → 'learner' are normalized so the frontend always sees
  // canonical roles.
  const canonicalRole = normalizeRole(user.role) || user.role;

  // Load course info (courseId + courseName from the user's enrollment)
  const courseInfo = await getCourseInfo(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: canonicalRole,
      currentWeek: user.currentWeek,
      approvedAt: user.approvedAt,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      hasSecurityQuestion: !!user.securityQuestion,
      courseId: courseInfo.courseId,
      courseName: courseInfo.courseName,
      // Post-purge: guardian role removed — linkedStudentId kept for shape
      // compat with existing frontend code that reads it.
      linkedStudentId: null,
    },
  });
}
