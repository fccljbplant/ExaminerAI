import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkEligibility } from "@/lib/certificate";

/**
 * GET /api/student/course-progress?courseId=...
 *
 * Auth: required (student).
 *
 * Returns the student's week-by-week progress for a specific course:
 *   {
 *     courseId, courseName,
 *     totalWeeks, completedWeeks, completionPercent,
 *     avgScore,
 *     weeklyBreakdown: [{ week, completed, score }],
 *     hasCertificate, certificateEligible,
 *   }
 *
 * A week is "completed" if any CurriculumProgress row exists for that week
 * (matching the certificate issuance criteria).
 * "score" is the WeeklyTest.score for that week (null if not yet tested).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json(
      { error: "Only students can view their own course progress" },
      { status: 403 },
    );
  }

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId query parameter is required" }, { status: 400 });
  }

  try {
    // Verify the student is enrolled.
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: user.id, courseId, role: "student" },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "You are not enrolled in this course" },
        { status: 403 },
      );
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        weeks: {
          select: { weekNumber: true },
          orderBy: { weekNumber: "asc" },
        },
      },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Parallel: progress rows + completed weekly tests + certificate + eligibility.
    const [progressRows, weeklyTests, existingCert, eligibility] = await Promise.all([
      db.curriculumProgress.findMany({
        where: { userId: user.id, courseId },
        select: { week: true },
      }),
      db.weeklyTest.findMany({
        where: { userId: user.id, courseId, status: "completed", score: { not: null } },
        select: { week: true, score: true },
      }),
      db.certificate.findFirst({
        where: { userId: user.id, courseId, grade: { not: "PENDING" } },
        select: { id: true },
      }),
      checkEligibility(user.id, courseId),
    ]);

    const completedWeeksSet = new Set(progressRows.map(p => p.week));
    const scoreByWeek = new Map<number, number | null>();
    for (const t of weeklyTests) {
      scoreByWeek.set(t.week, t.score);
    }

    const totalWeeks = course.weeks.length;
    const weeklyBreakdown = course.weeks.map(w => ({
      week: w.weekNumber,
      completed: completedWeeksSet.has(w.weekNumber),
      score: scoreByWeek.has(w.weekNumber) ? scoreByWeek.get(w.weekNumber) ?? null : null,
    }));

    const completedWeeks = weeklyBreakdown.filter(w => w.completed).length;
    const completionPercent = totalWeeks > 0
      ? Math.round((completedWeeks / totalWeeks) * 100)
      : 0;
    const scores = weeklyTests
      .map(t => t.score)
      .filter((s): s is number => s !== null);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    return NextResponse.json({
      courseId: course.id,
      courseName: course.name,
      totalWeeks,
      completedWeeks,
      completionPercent,
      avgScore,
      weeklyBreakdown,
      hasCertificate: Boolean(existingCert) || Boolean(eligibility?.hasCertificate),
      certificateEligible: eligibility?.eligible ?? false,
    });
  } catch (err) {
    logger.error("course-progress failed", {
      userId: user.id,
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load course progress" },
      { status: 500 },
    );
  }
}
