import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { getCourseDurationWeeks } from "@/lib/course-db";

/** GET /api/certificates/pending — list pending certificate requests for staff.
 *
 *  C4 fix (audit 2026-07-26): the certificate request/approve backend existed
 *  but there was no UI for staff to see pending requests. This endpoint powers
 *  the new CertificateApprovals component in the teacher dashboard.
 *
 *  Returns pending requests (grade="PENDING") for batches the staff member
 *  can access, plus computed eligibility info (completed tests, avg score,
 *  whether they've met the completion criteria) so the teacher can decide
 *  whether to approve.
 *
 *  Auth: staff only (teacher, course_coordinator, counselor, admin, principal).
 *  Teachers see only requests from students in their batches.
 *  Admins/principals see all requests in their institution.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "Forbidden — staff only" }, { status: 403 });
  }

  // Get accessible student IDs via CourseEnrollment
  let accessibleStudentIds: string[] | undefined;
  if (!hasRole(user.role, ADMIN_ROLES)) {
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: user.id, role: "instructor" },
      select: { courseId: true },
    });
    const courseIds = instructorCourses.map(c => c.courseId);
    if (courseIds.length > 0) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: courseIds }, role: "student" },
        select: { userId: true },
      });
      accessibleStudentIds = enrollments.map(e => e.userId);
    } else {
      accessibleStudentIds = []; // no courses = sees nothing
    }
  }

  // Fetch pending certificates (grade="PENDING") for the scoped students
  const pendingCerts = await db.certificate.findMany({
    where: {
      grade: "PENDING",
      user: {
        role: "student",
        ...(accessibleStudentIds !== undefined ? { id: { in: accessibleStudentIds } } : {}),
        blocked: false,
      },
    },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, currentWeek: true,
        },
      },
    },
    orderBy: { issuedAt: "desc" }, // issuedAt is the request date for PENDING rows
    take: 100,
  });

  // Compute eligibility for each request in parallel
  const requests = await Promise.all(pendingCerts.map(async (cert) => {
    const [totalWeeks, completedTests, completedTestScores] = await Promise.all([
      getCourseDurationWeeks(cert.user.id),
      db.weeklyTest.count({
        where: { userId: cert.user.id, status: "completed", score: { not: null } },
      }),
      db.weeklyTest.findMany({
        where: { userId: cert.user.id, status: "completed", score: { not: null } },
        select: { score: true },
      }),
    ]);
    const reachedFinalWeek = cert.user.currentWeek >= totalWeeks;
    const allTestsCompleted = completedTests >= totalWeeks;
    const scores = completedTestScores.map(t => t.score).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const eligible = reachedFinalWeek && allTestsCompleted;
    const ineligibleReason = !eligible
      ? (!reachedFinalWeek
          ? `Student is on week ${cert.user.currentWeek} of ${totalWeeks} — must reach the final week.`
          : `Student has completed ${completedTests} of ${totalWeeks} weekly tests — all must be completed.`)
      : undefined;

    return {
      id: cert.id,
      userId: cert.user.id,
      studentName: cert.user.name,
      studentEmail: cert.user.email,
      courseName: cert.courseName,
      requestedAt: cert.issuedAt,
      completedTests,
      totalWeeks,
      avgScore,
      eligible,
      ineligibleReason,
    };
  }));

  return NextResponse.json({ requests });
}
