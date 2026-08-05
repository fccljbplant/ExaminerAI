import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/interactions?userId=...&week=... — list interactions.
 *  - Students see only their own.
 *  - Teachers/admins can pass userId to view a specific student's interactions. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl;
  const userIdParam = url.searchParams.get("userId");
  const week = url.searchParams.get("week");

  let targetUserId = payload.sub;
  if (userIdParam && (isStaffRole(payload.role))) {
    targetUserId = userIdParam;
    // IDOR protection
    try { await assertCanAccessStudent(payload, targetUserId); } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }
  const interactions = await db.interaction.findMany({
    where: { userId: targetUserId, ...(week ? { week: Number(week) } : {}) },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ interactions });
}

/** POST /api/interactions — record a new AI assessment interaction. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing interactions"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    week, pillar, topic, question, projectContext, studentAnswer,
    timeTakenSeconds, answerLength,
    correctness, feedback, level, gaps, followUp,
  } = body as Record<string, unknown>;

  // Input validation — prevent resource exhaustion
  const MAX_TEXT_LEN = 10_000;
  if (question && String(question).length > MAX_TEXT_LEN) return NextResponse.json({ error: "question too long" }, { status: 400 });
  if (studentAnswer && String(studentAnswer).length > MAX_TEXT_LEN) return NextResponse.json({ error: "studentAnswer too long" }, { status: 400 });
  if (feedback && String(feedback).length > MAX_TEXT_LEN) return NextResponse.json({ error: "feedback too long" }, { status: 400 });
  if (topic && String(topic).length > 500) return NextResponse.json({ error: "topic too long" }, { status: 400 });

  const interaction = await db.interaction.create({
    data: {
      userId: user.id,
      week: Number(week ?? user.currentWeek),
      pillar: String(pillar ?? "Why Probe"),
      topic: String(topic ?? ""),
      question: String(question ?? ""),
      projectContext: String(projectContext ?? ""),
      studentAnswer: String(studentAnswer ?? ""),
      timeTakenSeconds: Number(timeTakenSeconds ?? 0),
      answerLength: Number(answerLength ?? 0),
      correctness: Number(correctness ?? 0),
      feedback: String(feedback ?? ""),
      level: String(level ?? "Beginner"),
      gaps: JSON.stringify(gaps ?? []),
      followUp: followUp ? String(followUp) : null,
    },
  });
  return NextResponse.json({ interaction });
}
