import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCourseInfo } from "@/lib/course-config";
import { db } from "@/lib/db";
import { normalizeRole } from "@/lib/rbac";

/** GET /api/auth/me — return the currently logged-in user's public profile.
 *
 *  For guardians, also returns `linkedStudentId` — the ID of the student
 *  they're linked to (via GuardianLink). The student dashboard uses this
 *  to load the linked student's data in read-only mode.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // Normalize the role — legacy aliases like 'admin' → 'administrator'
  // are normalized so the frontend always sees canonical roles.
  const canonicalRole = normalizeRole(user.role) || user.role;

  // Load course info (courseId + courseName from the user's batch)
  const courseInfo = await getCourseInfo(user.id);

  // Guardians — load their linked student (first one if multiple)
  let linkedStudentId: string | null = null;
  if (canonicalRole === "guardian") {
    const link = await db.guardianLink.findFirst({
      where: { guardianId: user.id },
      select: { studentId: true },
    });
    linkedStudentId = link?.studentId ?? null;
  }

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
      // C5 fix (audit 2026-07-26): expose batchId so the instructor AssignmentsTab
      // can pass it to POST /api/group-tasks (which requires batchId). Without
      // this, teachers could never create assignments (the API returned 400).
      batchId: user.batchId,
      linkedStudentId,
    },
  });
}
