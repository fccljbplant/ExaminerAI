import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/peer-assessment?groupTaskId=X
 *   - Students: get their pending peer assessments (teammates they haven't rated yet)
 *   - Teachers: get all peer assessments for a group task
 *
 * GET /api/peer-assessment?mine=true
 *   - Students: get assessments others have given about them (aggregate, no names)
 */

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const groupTaskId = url.searchParams.get("groupTaskId");
  const mine = url.searchParams.get("mine");

  // Student requesting their own aggregate peer feedback (no names)
  if (mine === "true") {
    const assessments = await db.peerAssessment.findMany({
      where: { assesseeId: user.id },
      select: {
        collaboration: true, contribution: true, communication: true,
        reliability: true, respect: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (assessments.length === 0) {
      return NextResponse.json({ assessments: [], summary: null });
    }

    // Compute aggregate
    const avg = (key: keyof typeof assessments[0]) =>
      Math.round((assessments.reduce((a, x) => a + (x[key] as number), 0) / assessments.length) * 10) / 10;

    const summary = {
      count: assessments.length,
      collaboration: avg("collaboration"),
      contribution: avg("contribution"),
      communication: avg("communication"),
      reliability: avg("reliability"),
      respect: avg("respect"),
      overall: Math.round(((
        avg("collaboration") + avg("contribution") + avg("communication") +
        avg("reliability") + avg("respect")
      ) / 5) * 10) / 10,
    };

    return NextResponse.json({ assessments, summary });
  }

  // Teacher viewing all peer assessments for a task
  const isStaff = ["instructor", "coordinator", "counselor", "principal", "administrator", "demo", "admin"].includes(user.role);
  if (isStaff && groupTaskId) {
    const assessments = await db.peerAssessment.findMany({
      where: { groupTaskId },
      include: {
        assessor: { select: { id: true, name: true } },
        assessee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ assessments });
  }

  // Student requesting pending assessments (teammates to rate)
  if (!groupTaskId) return NextResponse.json({ error: "groupTaskId required" }, { status: 400 });

  // Get all students who submitted this task (potential teammates)
  const submissions = await db.groupTaskSubmission.findMany({
    where: { groupTaskId },
    include: { user: { select: { id: true, name: true } } },
  });

  // Get assessments the student has already given
  const given = await db.peerAssessment.findMany({
    where: { groupTaskId, assessorId: user.id },
    select: { assesseeId: true },
  });
  const alreadyRated = new Set(given.map(g => g.assesseeId));

  // Pending = other students who submitted, minus self, minus already rated
  const pending = submissions
    .filter(s => s.userId !== user.id && !alreadyRated.has(s.userId))
    .map(s => ({ userId: s.user.id, name: s.user.name }));

  return NextResponse.json({ pending, totalToRate: pending.length });
}

/**
 * POST /api/peer-assessment — submit a peer assessment
 * Body: { groupTaskId, assesseeId, collaboration, contribution, communication, reliability, respect, textFeedback? }
 *
 * After ALL peer assessments for a task are submitted, the pipeline runs
 * for each assessed student — feeding PsychEvidence (attribution/mindset +
 * collaboration signals) and SkillMastery (collaboration skill).
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("submitting peer assessments"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can submit peer assessments" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { groupTaskId, assesseeId, collaboration, contribution, communication, reliability, respect, textFeedback } = body as {
    groupTaskId?: string; assesseeId?: string;
    collaboration?: number; contribution?: number; communication?: number;
    reliability?: number; respect?: number; textFeedback?: string;
  };

  if (!groupTaskId || !assesseeId) {
    return NextResponse.json({ error: "groupTaskId and assesseeId required" }, { status: 400 });
  }

  // Validate ratings (1-5) — after validation, assert as number
  const ratings = { collaboration, contribution, communication, reliability, respect };
  for (const [key, val] of Object.entries(ratings)) {
    if (typeof val !== "number" || val < 1 || val > 5) {
      return NextResponse.json({ error: `${key} must be 1-5` }, { status: 400 });
    }
  }
  const r = ratings as { collaboration: number; contribution: number; communication: number; reliability: number; respect: number };

  // Can't rate yourself
  if (assesseeId === user.id) {
    return NextResponse.json({ error: "Cannot assess yourself" }, { status: 400 });
  }

  // Verify both students submitted this task
  const [mySubmission, theirSubmission] = await Promise.all([
    db.groupTaskSubmission.findUnique({ where: { groupTaskId_userId: { groupTaskId, userId: user.id } } }),
    db.groupTaskSubmission.findUnique({ where: { groupTaskId_userId: { groupTaskId, userId: assesseeId } } }),
  ]);
  if (!mySubmission) {
    return NextResponse.json({ error: "You must submit your own work first" }, { status: 400 });
  }
  if (!theirSubmission) {
    return NextResponse.json({ error: "That student hasn't submitted this task" }, { status: 400 });
  }

  try {
    const assessment = await db.peerAssessment.upsert({
      where: { groupTaskId_assessorId_assesseeId: { groupTaskId, assessorId: user.id, assesseeId } },
      create: {
        groupTaskId, assessorId: user.id, assesseeId,
        collaboration: r.collaboration, contribution: r.contribution, communication: r.communication, reliability: r.reliability, respect: r.respect,
        textFeedback: textFeedback?.trim() || "",
      },
      update: {
        collaboration: r.collaboration, contribution: r.contribution, communication: r.communication, reliability: r.reliability, respect: r.respect,
        textFeedback: textFeedback?.trim() || "",
      },
    });

    // Check if all peer assessments are complete for this task
    // (i.e., every student who submitted has rated every other student who submitted)
    const allSubmissions = await db.groupTaskSubmission.findMany({
      where: { groupTaskId },
      select: { userId: true },
    });
    const allAssessments = await db.peerAssessment.findMany({
      where: { groupTaskId },
      select: { assessorId: true, assesseeId: true },
    });

    const expectedCount = allSubmissions.length * (allSubmissions.length - 1); // n*(n-1) pairs
    if (allAssessments.length >= expectedCount && expectedCount > 0) {
      // All assessments complete — run the pipeline for each assessed student.
      // H7-rel: idempotency note — two students submitting the final
      // assessments simultaneously can both trigger this branch. The
      // pipeline is best-effort (void + catch), and upserts are mostly
      // idempotent, but ConfidenceRating creates new rows each call.
      logger.info("All peer assessments complete for group task", { groupTaskId, pairs: allAssessments.length });

      for (const submission of allSubmissions) {
        const received = await db.peerAssessment.findMany({
          where: { groupTaskId, assesseeId: submission.userId },
          select: { collaboration: true, contribution: true, communication: true, reliability: true, respect: true, textFeedback: true },
        });

        if (received.length === 0) continue;

        const avgScore = (key: keyof typeof received[0]) =>
          received.reduce((a, r) => a + (r[key] as number), 0) / received.length;
        const overall = (avgScore("collaboration") + avgScore("contribution") + avgScore("communication") + avgScore("reliability") + avgScore("respect")) / 5;
        // Convert 1-5 to 0-100 for the pipeline
        const score100 = Math.round((overall / 5) * 100);

        // Get the group task for context
        const task = await db.groupTask.findUnique({
          where: { id: groupTaskId },
          select: { week: true, title: true, courseId: true },
        });

        // Run the analysis pipeline — peer assessment feeds:
        // - PsychEvidence (attribution/mindset: how does the student collaborate?)
        // - SkillMastery (collaboration as a skill)
        void runAnalysisPipeline({
          userId: submission.userId,
          testId: `peer-assessment-${groupTaskId}`,
          testType: "daily_test", // reuse the pipeline's daily_test path
          week: task?.week ?? 1,
          score: score100,
          topics: [task?.title || "group collaboration"],
          answers: received.map((r, i) => ({
            question: `Peer assessment dimension ${i + 1}`,
            answer: `Collaboration: ${r.collaboration}/5, Contribution: ${r.contribution}/5, Communication: ${r.communication}/5, Reliability: ${r.reliability}/5, Respect: ${r.respect}/5`,
            score: Math.round(((r.collaboration + r.contribution + r.communication + r.reliability + r.respect) / 25) * 100),
            confidenceRating: null,
            topic: "peer collaboration",
          })),
        }).catch(err => logger.warn("Analysis pipeline failed", { error: err instanceof Error ? err.message : String(err) }));
      }
    }

    return NextResponse.json({ assessment });
  } catch (err) {
    logger.error("Peer assessment submission failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
