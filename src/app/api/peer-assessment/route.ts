import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
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

    return NextResponse.json({ assessment });
  } catch (err) {
    logger.error("Peer assessment submission failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
