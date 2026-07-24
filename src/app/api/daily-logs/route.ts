import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/daily-logs?week=3 — list current user's logs, optionally filtered by week. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const week = req.nextUrl.searchParams.get("week");
  const logs = await db.dailyLog.findMany({
    where: {
      userId: user.id,
      ...(week ? { week: Number(week) } : {}),
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ logs });
}

/** POST /api/daily-logs — create a daily check-in.
 *  Accepts the original fields PLUS learning reflection fields:
 *  - learningReflection: "What did you learn today?"
 *  - confusionNotes: "What confused you?"
 *  - nextQuestion: "What's your next question to explore?"
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing daily logs"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    whatDidYouDo, anyErrors, confidence, gitCommit, week,
    learningReflection, confusionNotes, nextQuestion,
  } = body as {
    whatDidYouDo?: string;
    anyErrors?: string;
    confidence?: number;
    gitCommit?: string;
    week?: number;
    learningReflection?: string;
    confusionNotes?: string;
    nextQuestion?: string;
  };
  if (!whatDidYouDo?.trim()) {
    return NextResponse.json({ error: "whatDidYouDo is required" }, { status: 400 });
  }
  // Input length validation — prevent resource exhaustion (10K char limit per field)
  const MAX_FIELD_LEN = 10_000;
  if (whatDidYouDo.length > MAX_FIELD_LEN) return NextResponse.json({ error: "whatDidYouDo too long (max 10000 chars)" }, { status: 400 });
  if (anyErrors && anyErrors.length > MAX_FIELD_LEN) return NextResponse.json({ error: "anyErrors too long (max 10000 chars)" }, { status: 400 });
  if (learningReflection && learningReflection.length > MAX_FIELD_LEN) return NextResponse.json({ error: "learningReflection too long" }, { status: 400 });
  if (confusionNotes && confusionNotes.length > MAX_FIELD_LEN) return NextResponse.json({ error: "confusionNotes too long" }, { status: 400 });
  if (nextQuestion && nextQuestion.length > 500) return NextResponse.json({ error: "nextQuestion too long (max 500 chars)" }, { status: 400 });
  if (gitCommit && gitCommit.length > 200) return NextResponse.json({ error: "gitCommit too long (max 200 chars)" }, { status: 400 });
  const log = await db.dailyLog.create({
    data: {
      userId: user.id,
      week: week ?? user.currentWeek,
      whatDidYouDo: whatDidYouDo.trim(),
      anyErrors: anyErrors ?? "",
      confidence: confidence ?? 3,
      gitCommit: gitCommit ?? null,
      learningReflection: learningReflection?.trim() ?? "",
      confusionNotes: confusionNotes?.trim() ?? "",
      nextQuestion: nextQuestion?.trim() ?? "",
    },
  });
  return NextResponse.json({ log });
}
