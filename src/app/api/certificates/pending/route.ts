import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { checkEligibility } from "@/modules/course/lib/certificate";

/**
 * GET /api/certificates/pending
 *
 * Returns pending requests only when the staff member is authorised for the
 * learner AND the exact course on the request. Eligibility is recalculated
 * from that course's published weeks and assessment attempts.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden — staff only" }, { status: 403 });
  }

  const pendingCerts = await db.certificate.findMany({
    where: {
      grade: "PENDING",
      courseId: { not: null },
      user: {
        role: { in: ["student", "learner"] },
        blocked: false,
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  const requests = await Promise.all(pendingCerts.map(async (cert) => {
    const courseId = cert.courseId;
    if (!courseId) return null;

    try {
      await assertCanAccessStudent(payload, cert.user.id, "content_only");
      const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, cert.user.id);
      if (!authorisedCourseIds.includes(courseId)) return null;

      const [eligibility, completedTestRows] = await Promise.all([
        checkEligibility(cert.user.id, courseId),
        db.weeklyTest.findMany({
          where: { userId: cert.user.id, courseId, status: "completed", score: { not: null } },
          select: { week: true },
          distinct: ["week"],
        }),
      ]);

      const totalWeeks = eligibility?.totalWeeks ?? 0;
      const completedTests = completedTestRows.length;
      let ineligibleReason: string | undefined;
      if (!eligibility) {
        ineligibleReason = "Course eligibility could not be verified. Retry before approving.";
      } else if (eligibility.hasCertificate) {
        ineligibleReason = "A certificate has already been issued for this course.";
      } else if (eligibility.weeksCompleted < totalWeeks) {
        ineligibleReason = `Course content progress is ${eligibility.weeksCompleted} of ${totalWeeks} weeks.`;
      } else if (completedTests < totalWeeks) {
        ineligibleReason = `Weekly assessments are ${completedTests} of ${totalWeeks} weeks.`;
      } else if (eligibility.avgScore === null) {
        ineligibleReason = "Assessment score evidence is unavailable.";
      } else if (!eligibility.eligible) {
        ineligibleReason = "The course certificate score threshold has not been met.";
      }

      return {
        id: cert.id,
        userId: cert.user.id,
        courseId,
        studentName: cert.user.name,
        studentEmail: cert.user.email,
        courseName: cert.courseName,
        requestedAt: cert.issuedAt,
        completedTests,
        totalWeeks,
        avgScore: eligibility?.avgScore ?? null,
        eligible: Boolean(eligibility?.eligible),
        ineligibleReason,
      };
    } catch {
      // Do not expose records when learner access or course scope cannot be verified.
      return null;
    }
  }));

  return NextResponse.json({ requests: requests.filter((request) => request !== null) });
}
