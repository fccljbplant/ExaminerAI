import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkEligibility } from "@/modules/course/lib/certificate";

/**
 * GET /api/certificates/user?courseId=...
 * Returns the learner's issued certificate and progress for one enrolled
 * course. Multiple enrolments require an explicit course selection.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: user.id, role: "student" },
    select: { courseId: true, course: { select: { name: true } } },
  });
  const courses = enrollments.map((enrollment) => ({
    id: enrollment.courseId,
    name: enrollment.course.name,
  }));
  if (courses.length === 0) {
    return NextResponse.json({ error: "No enrolled course is available for certificate progress" }, { status: 404 });
  }

  const requestedCourseId = req.nextUrl.searchParams.get("courseId");
  if (!requestedCourseId && courses.length > 1) {
    return NextResponse.json({ courseSelectionRequired: true, courses });
  }
  const courseId = requestedCourseId ?? courses[0].id;
  if (!courses.some((course) => course.id === courseId)) {
    return NextResponse.json({ error: "You are not enrolled in the selected course" }, { status: 403 });
  }

  const [course, progressRows, completedTestRows, certificate, eligibility] = await Promise.all([
    db.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } } },
    }),
    db.curriculumProgress.findMany({
      where: { userId: user.id, courseId },
      select: { week: true },
      distinct: ["week"],
    }),
    db.weeklyTest.findMany({
      where: { userId: user.id, courseId, status: "completed", score: { not: null } },
      select: { week: true },
      distinct: ["week"],
    }),
    db.certificate.findFirst({
      where: { userId: user.id, courseId, grade: { notIn: ["PENDING", "REJECTED"] } },
      orderBy: { issuedAt: "desc" },
    }),
    checkEligibility(user.id, courseId),
  ]);

  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const totalWeeks = course.weeks.length;
  const completedWeeks = progressRows.length;
  const completedTests = completedTestRows.length;
  const courseWeekNumbers = course.weeks.map((week) => week.weekNumber);
  const completedWeekNumbers = new Set(progressRows.map((row) => row.week));
  const completedTestWeeks = new Set(completedTestRows.map((row) => row.week));
  const reachedFinalWeek = totalWeeks > 0 && courseWeekNumbers.every((week) => completedWeekNumbers.has(week));
  const allTestsCompleted = totalWeeks > 0 && courseWeekNumbers.every((week) => completedTestWeeks.has(week));
  const latestCompletedWeek = progressRows.reduce((latest, row) => Math.max(latest, row.week), 0);
  const currentWeek = totalWeeks > 0 ? Math.min(totalWeeks, latestCompletedWeek + 1) : null;
  const progressPercent = totalWeeks > 0
    ? Math.round((
        Math.min(100, Math.round((completedWeeks / totalWeeks) * 100)) +
        Math.min(100, Math.round((completedTests / totalWeeks) * 100))
      ) / 2)
    : null;

  return NextResponse.json({
    certificate: certificate
      ? {
          id: certificate.id,
          courseId: certificate.courseId,
          courseName: certificate.courseName,
          studentName: certificate.studentName,
          grade: certificate.grade,
          score: certificate.score,
          issuedAt: certificate.issuedAt,
          signedBy: certificate.signedBy,
          verifyToken: certificate.verifyToken,
          verifyUrl: `/verify/${certificate.credentialId ?? certificate.verifyToken}`,
        }
      : null,
    completion: {
      courseId,
      courseName: course.name,
      currentWeek,
      totalWeeks,
      weeksCompleted: completedWeeks,
      reachedFinalWeek,
      completedTests,
      allTestsCompleted,
      progressPercent,
      eligible: eligibility.eligible,
      averageScore: eligibility.avgScore,
    },
  });
}
