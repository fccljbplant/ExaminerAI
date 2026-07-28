import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** GET /api/growth-reports/[userId] — get or generate a student's private
 *  growth report.
 *
 *  This is NOT publicly accessible (unlike certificate verify). Only:
 *  - The student themselves
 *  - Staff with existing access to that student (assertCanAccessStudent)
 *
 *  The report contains honest strengths AND shortcomings — the full picture.
 *  The certificate stays simple and positive; the growth report is the
 *  private, honest document a student shares with a mentor, not an employer.
 *
 *  Generation: if no report exists, generates one from:
 *  - Final-result data (same source as certificate)
 *  - 7-dimension PsychEvidence profile
 *  - Mentorship touchpoint history
 *  - Weekly test scores + practice scores
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

  // Check if a report already exists (idempotent — generate once, return cached)
  const existing = await db.growthReport.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json({ report: existing });
  }

  // Generate a new report
  try {
    const report = await generateGrowthReport(userId);
    return NextResponse.json({ report });
  } catch (err) {
    logger.error("Growth report generation failed", {
      userId, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to generate growth report" }, { status: 500 });
  }
}

/** Generate a growth report from real data — honest strengths AND shortcomings. */
async function generateGrowthReport(userId: string) {
  // Fetch all the data we need
  const [user, psychEvidence, touchpoints, weeklyTests, interactions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, currentWeek: true,
        weeklyTests: { where: { status: "completed" }, select: { week: true, score: true }, orderBy: { week: "asc" } },
        interactions: { select: { correctness: true, week: true }, take: 500 },
        projectReports: { select: { aiAnalysis: true, week: true }, orderBy: { week: "asc" } },
      },
    }),
    db.psychEvidence.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { dimension: true, value: true, evidenceText: true, week: true, createdAt: true },
    }),
    db.mentorshipTouchpoint.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, note: true, outcome: true, createdAt: true },
    }),
    // Re-fetch for score computation
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
  ]);

  if (!user) throw new Error("User not found");

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

  // --- Build 7-dimension snapshot ---
  const dimensions: Record<string, { value: string; evidence: string; week: number | null }> = {};
  for (const ev of psychEvidence) {
    if (!dimensions[ev.dimension]) {
      dimensions[ev.dimension] = { value: ev.value, evidence: ev.evidenceText, week: ev.week };
    }
  }

  // --- Build strengths (honest, from data) ---
  const strengths: string[] = [];
  if (dimensions.explanatory_depth?.value === "detailed_reasoning") {
    strengths.push("Demonstrated detailed, step-by-step reasoning in test answers — connects concepts rather than reciting facts.");
  } else if (dimensions.explanatory_depth?.value === "moderate_depth") {
    strengths.push("Showed moderate explanatory depth — can explain concepts with some detail when prompted.");
  }
  if (dimensions.attribution?.value === "growth_mindset") {
    strengths.push("Consistently used growth-mindset language (\"learn\", \"practice\", \"improve\") — attributes success to effort, not innate ability.");
  }
  if (dimensions.calibration?.value === "well_calibrated") {
    strengths.push("Self-confidence accurately matches actual performance — strong self-awareness.");
  } else if (dimensions.calibration?.value === "underconfident") {
    strengths.push("Performed better than self-rated confidence suggested — knows more than they think.");
  }
  if (dimensions.gaming_pattern?.value === "authentic_voice") {
    strengths.push("Consistent voice across all answers — no signs of AI-generated content. Work is authentically their own.");
  }
  if (avgTestScore >= 75) {
    strengths.push(`Strong overall test performance (${avgTestScore}% average across ${testScores.length} weekly tests).`);
  }
  if (dimensions.fluency?.value === "fluent" || dimensions.fluency?.value === "improving") {
    strengths.push("Knowledge recall improved over the course — retrieval practice is working.");
  }

  // --- Build growth areas (honest shortcomings) ---
  const growthAreas: string[] = [];
  if (dimensions.calibration?.value === "overconfident") {
    growthAreas.push("Tended to over-rate confidence vs. actual performance — may not realize gaps. Benefit from reviewing wrong answers and explaining why.");
  }
  if (dimensions.explanatory_depth?.value === "surface_answers") {
    growthAreas.push("Answers were often very short — may indicate rushing or surface-level understanding. Practice explaining reasoning in detail.");
  }
  if (dimensions.attribution?.value === "fixed_mindset") {
    growthAreas.push("Used fixed-mindset language (\"can't\", \"not good at\"). Benefit from effort-based praise and reframing challenges as growth opportunities.");
  }
  if (dimensions.attribution?.value === "avoidant") {
    growthAreas.push("Multiple avoidance responses (\"I don't know\", \"skip\"). May indicate uncertainty or lack of preparation. Create safe spaces for wrong answers.");
  }
  if (dimensions.cognitive_load?.value === "high_intrinsic") {
    growthAreas.push("Material was consistently too difficult (scores below 40%). Benefit from breaking concepts into smaller pieces and reviewing prerequisites.");
  }
  if (dimensions.gaming_pattern?.value === "voice_inconsistency") {
    growthAreas.push("Voice inconsistency detected in some answers — possible AI assistance on specific questions. Discuss academic integrity.");
  }
  if (dimensions.fluency?.value === "declining" || dimensions.fluency?.value === "fragmented") {
    growthAreas.push("Knowledge recall was inconsistent or declining over time. Benefit from spaced repetition and review sessions.");
  }
  if (avgTestScore < 50 && testScores.length > 0) {
    growthAreas.push(`Overall test performance was below 50% (${avgTestScore}% average). Core concepts need reinforcement before advancing.`);
  }
  if (testScores.length === 0) {
    growthAreas.push("No completed weekly tests — insufficient data for performance assessment.");
  }

  // --- Build behavioral notes from mentorship touchpoints ---
  let behavioralNotes: string | null = null;
  if (touchpoints.length > 0) {
    const touchpointSummary = touchpoints.map(t =>
      `${t.type}: ${t.note}${t.outcome ? ` (outcome: ${t.outcome})` : ""}`
    ).join(" | ");
    behavioralNotes = `${touchpoints.length} coaching touchpoints logged. ${touchpointSummary}`;
  }

  // --- Fetch the student's course ID from their enrollment ---
  const enrollment = await db.courseEnrollment.findFirst({
    where: { userId, role: "student" },
    select: { courseId: true },
  });
  const courseId = enrollment?.courseId ?? null;

  // --- Create the report ---
  const report = await db.growthReport.create({
    data: {
      userId,
      courseId,
      strengths: JSON.stringify(strengths.length > 0 ? strengths : ["Insufficient data for strengths assessment."]),
      growthAreas: JSON.stringify(growthAreas.length > 0 ? growthAreas : ["Insufficient data for growth areas assessment."]),
      dimensionSnapshot: JSON.stringify({
        performanceScore,
        avgTestScore,
        avgPracticeScore,
        testCount: testScores.length,
        dimensions,
      }),
      behavioralNotes,
    },
  });

  return report;
}
