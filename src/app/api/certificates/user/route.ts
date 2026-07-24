import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCourseDurationWeeks } from "@/lib/course-db";

/** GET /api/certificates/user — returns the student's certificate if one
 *  exists, plus their completion status (whether they've earned one yet).
 *
 *  Phase 4.5. Used by the student dashboard to show the certificate +
 *  shareable verification URL, OR to show "you're X% of the way to earning
 *  your certificate" progress.
 *
 *  Returns:
 *    {
 *      certificate: Certificate | null,
 *      completion: {
 *        currentWeek, totalWeeks, reachedFinalWeek,
 *        completedTests, allTestsCompleted,
 *        progressPercent, // 0-100
 *        eligible: boolean
 *      }
 *    }
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [certificate, totalWeeks, completedTests] = await Promise.all([
    db.certificate.findFirst({
      where: { userId: user.id },
      orderBy: { issuedAt: "desc" },
    }),
    getCourseDurationWeeks(user.id),
    db.weeklyTest.count({
      where: { userId: user.id, status: "completed", score: { not: null } },
    }),
  ]);

  const reachedFinalWeek = user.currentWeek >= totalWeeks;
  const allTestsCompleted = completedTests >= totalWeeks;
  const eligible = reachedFinalWeek && allTestsCompleted;

  // Progress toward certificate: average of (week progress) + (test progress)
  const weekProgress = Math.min(100, Math.round((user.currentWeek / totalWeeks) * 100));
  const testProgress = Math.min(100, Math.round((completedTests / totalWeeks) * 100));
  const progressPercent = Math.round((weekProgress + testProgress) / 2);

  return NextResponse.json({
    certificate: certificate
      ? {
          id: certificate.id,
          courseName: certificate.courseName,
          studentName: certificate.studentName,
          grade: certificate.grade,
          score: certificate.score,
          issuedAt: certificate.issuedAt,
          signedBy: certificate.signedBy,
          verifyToken: certificate.verifyToken,
          verifyUrl: `/verify/${certificate.verifyToken}`,
        }
      : null,
    completion: {
      currentWeek: user.currentWeek,
      totalWeeks,
      reachedFinalWeek,
      completedTests,
      allTestsCompleted,
      progressPercent,
      eligible,
    },
  });
}
