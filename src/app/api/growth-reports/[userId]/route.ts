import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";

/**
 * GET /api/growth-reports/[userId]?courseId=...
 *
 * Learners may view their own cross-course summary or request one enrolled
 * course. Staff must request a specific course and pass server-side course
 * authorization; course-less legacy evidence is never attributed to it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const isSelf = payload.sub === userId;
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!isSelf) {
    try {
      await assertCanAccessStudent(payload, userId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required for staff growth reports" }, { status: 400 });
    }
    const authorizedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, userId);
    if (!authorizedCourseIds.includes(courseId)) {
      return NextResponse.json({ error: "You cannot access this learner's selected course" }, { status: 403 });
    }
  } else if (courseId) {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId, role: "student", courseId },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
    }
  }

  try {
    const report = await computeGrowthReport(userId, courseId);
    if (!report) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (err) {
    logger.error("Growth report generation failed", {
      userId,
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to generate growth report" }, { status: 500 });
  }
}

/** Compute a report only from evidence belonging to the requested course. */
async function computeGrowthReport(userId: string, courseId: string | null) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return null;

  const courseFilter = courseId ? { courseId } : {};
  const [weeklyTests, interactions] = await Promise.all([
    db.weeklyTest.findMany({
      where: { userId, status: "completed", score: { not: null }, ...courseFilter },
      select: { week: true, score: true },
      orderBy: { week: "asc" },
    }),
    db.interaction.findMany({
      where: { userId, ...courseFilter },
      select: { correctness: true },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const testScores = weeklyTests
    .map((test) => test.score)
    .filter((score): score is number => score !== null);
  // Correctness is a measured percentage; zero is valid evidence, not missing data.
  const practiceScores = interactions.map((interaction) => interaction.correctness);
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((sum, score) => sum + score, 0) / testScores.length)
    : null;
  const avgPracticeScore = practiceScores.length > 0
    ? Math.round(practiceScores.reduce((sum, score) => sum + score, 0) / practiceScores.length)
    : null;
  const performanceScore = avgTestScore !== null && avgPracticeScore !== null
    ? Math.round(avgTestScore * 0.5 + avgPracticeScore * 0.5)
    : avgTestScore ?? avgPracticeScore;

  const strengths: string[] = [];
  if (avgTestScore !== null && avgTestScore >= 75) {
    strengths.push(`Strong overall test performance (${avgTestScore}% average across ${testScores.length} weekly tests).`);
  }
  if (avgPracticeScore !== null && avgPracticeScore >= 75) {
    strengths.push(`Strong practice performance (${avgPracticeScore}% average across ${practiceScores.length} practice questions).`);
  }

  const growthAreas: string[] = [];
  if (avgTestScore !== null && avgTestScore < 50) {
    growthAreas.push(`Overall test performance was below 50% (${avgTestScore}% average). Core concepts need reinforcement before advancing.`);
  }
  if (avgPracticeScore !== null && avgPracticeScore < 50) {
    growthAreas.push(`Practice question accuracy was below 50% (${avgPracticeScore}% average). Benefit from more practice and reviewing wrong answers.`);
  }
  if (testScores.length === 0 && practiceScores.length === 0) {
    growthAreas.push("Insufficient course-specific assessment and practice evidence for a performance assessment.");
  } else if (testScores.length === 0) {
    growthAreas.push("No completed weekly tests — test performance is unavailable.");
  } else if (practiceScores.length === 0) {
    growthAreas.push("No practice answers recorded — practice performance is unavailable.");
  }

  return {
    userId,
    courseId,
    strengths: JSON.stringify(strengths),
    growthAreas: JSON.stringify(growthAreas),
    dimensionSnapshot: JSON.stringify({
      performanceScore,
      avgTestScore,
      avgPracticeScore,
      testCount: testScores.length,
      practiceCount: practiceScores.length,
    }),
    behavioralNotes: null,
    generatedAt: new Date(),
  };
}
