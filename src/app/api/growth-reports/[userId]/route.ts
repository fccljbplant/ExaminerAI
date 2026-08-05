import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** GET /api/growth-reports/[userId] — compute a student's private growth report.
 *
 *  This is NOT publicly accessible (unlike certificate verify). Only:
 *  - The student themselves
 *  - Staff with existing access to that student (assertCanAccessStudent)
 *
 *  The report contains honest strengths AND shortcomings — the full picture.
 *  The certificate stays simple and positive; the growth report is the
 *  private, honest document a student shares with a mentor, not an employer.
 *
 *  Computed live from academic data (weekly test scores + practice scores).
 *  Previously persisted to a GrowthReport table; that table has been removed,
 *  so the report is regenerated on every request.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  // Access check: student sees own report; staff needs assertCanAccessStudent
  if (payload.sub !== userId) {
    try {
      await assertCanAccessStudent(payload, userId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Compute the report live
  try {
    const report = await computeGrowthReport(userId);
    if (!report) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (err) {
    logger.error("Growth report generation failed", {
      userId, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to generate growth report" }, { status: 500 });
  }
}

/** Compute a growth report from real data — honest strengths AND shortcomings. */
async function computeGrowthReport(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, currentWeek: true,
    },
  });

  if (!user) return null;

  // Fetch academic data in parallel
  const [weeklyTests, interactions, enrollment] = await Promise.all([
    db.weeklyTest.findMany({
      where: { userId, status: "completed", score: { not: null } },
      select: { week: true, score: true },
      orderBy: { week: "asc" },
    }),
    db.interaction.findMany({
      where: { userId },
      select: { correctness: true },
      take: 500,
    }),
    db.courseEnrollment.findFirst({
      where: { userId, role: "student" },
      select: { courseId: true },
    }),
  ]);

  // --- Compute scores (same logic as final-result, NOT inflated) ---
  const testScores = weeklyTests.map(t => t.score).filter((s): s is number => s !== null);
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
    : 0;

  const practiceScores = interactions.map(i => i.correctness).filter(c => c > 0);
  const avgPracticeScore = practiceScores.length > 0
    ? Math.round(practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length)
    : 0;

  const performanceScore = testScores.length > 0 && practiceScores.length > 0
    ? Math.round(avgTestScore * 0.5 + avgPracticeScore * 0.5)
    : testScores.length > 0 ? avgTestScore : avgPracticeScore;

  // --- Build strengths (honest, from academic data) ---
  const strengths: string[] = [];
  if (avgTestScore >= 75) {
    strengths.push(`Strong overall test performance (${avgTestScore}% average across ${testScores.length} weekly tests).`);
  }
  if (avgPracticeScore >= 75) {
    strengths.push(`Strong practice performance (${avgPracticeScore}% average across ${practiceScores.length} practice questions).`);
  }

  // --- Build growth areas (honest shortcomings) ---
  const growthAreas: string[] = [];
  if (avgTestScore < 50 && testScores.length > 0) {
    growthAreas.push(`Overall test performance was below 50% (${avgTestScore}% average). Core concepts need reinforcement before advancing.`);
  }
  if (avgPracticeScore < 50 && practiceScores.length > 0) {
    growthAreas.push(`Practice question accuracy was below 50% (${avgPracticeScore}% average). Benefit from more practice and reviewing wrong answers.`);
  }
  if (testScores.length === 0) {
    growthAreas.push("No completed weekly tests — insufficient data for performance assessment.");
  }

  const courseId = enrollment?.courseId ?? null;

  // --- Return the report object (no DB persistence — table dropped) ---
  return {
    userId,
    courseId,
    strengths: JSON.stringify(strengths.length > 0 ? strengths : ["Insufficient data for strengths assessment."]),
    growthAreas: JSON.stringify(growthAreas.length > 0 ? growthAreas : ["Insufficient data for growth areas assessment."]),
    dimensionSnapshot: JSON.stringify({
      performanceScore,
      avgTestScore,
      avgPracticeScore,
      testCount: testScores.length,
    }),
    behavioralNotes: null,
    generatedAt: new Date(),
  };
}
