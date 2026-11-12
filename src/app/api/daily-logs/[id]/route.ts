import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** H2 fix (audit 2026-07-26): verify the daily log belongs to a student the
 *  caller can access BEFORE modifying/deleting it. The previous version accepted
 *  ANY daily log ID — a teacher could edit/delete logs for students in batches
 *  they don't teach. */
async function verifyDailyLogOwnership(payload: { sub: string; role: string; email: string; name: string }, logId: string) {
  const log = await db.dailyLog.findUnique({
    where: { id: logId },
    select: { userId: true },
  });
  if (!log) {
    return { error: NextResponse.json({ error: "Daily log not found" }, { status: 404 }) };
  }
  try {
    await assertCanAccessStudent(payload, log.userId);
  } catch (err) {
    return { error: NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 }) };
  }
  return { userId: log.userId };
}

/** PATCH /api/daily-logs/[id] — edit a daily check-in.
 *
 *  Students can edit their OWN check-ins. Staff (teachers/admins) can edit
 *  check-ins for students they have access to (via assertCanAccessStudent).
 *
 *  Body (all optional):
 *    - whatDidYouDo, anyErrors, confidence, gitCommit, week
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing daily logs"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // H2 fix: verify ownership before updating.
  // Students can edit their own logs; staff can edit logs for students they
  // have access to. verifyDailyLogOwnership calls assertCanAccessStudent which
  // handles both cases (students = self-only, staff = scoped access).
  const ownership = await verifyDailyLogOwnership(payload, id);
  if ("error" in ownership) return ownership.error;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.whatDidYouDo !== undefined) data.whatDidYouDo = String(body.whatDidYouDo);
  if (body.anyErrors !== undefined) data.anyErrors = String(body.anyErrors);
  if (body.confidence !== undefined) data.confidence = Number(body.confidence);
  if (body.gitCommit !== undefined) data.gitCommit = body.gitCommit || null;
  if (body.week !== undefined) data.week = Number(body.week);
  if (body.learningReflection !== undefined) data.learningReflection = String(body.learningReflection);
  if (body.confusionNotes !== undefined) data.confusionNotes = String(body.confusionNotes);
  if (body.nextQuestion !== undefined) data.nextQuestion = String(body.nextQuestion);

  const log = await db.dailyLog.update({ where: { id }, data });
  return NextResponse.json({ log });
}

/** DELETE /api/daily-logs/[id] — delete a check-in only when no mentor feedback is attached.
 *
 *  Instructor feedback is an independent mentoring record. Deleting a learner
 *  check-in must not silently erase that record.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing daily logs"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // H2 fix: verify ownership before deleting.
  // Students can delete their own logs; staff can delete logs for students
  // they have access to.
  const ownership = await verifyDailyLogOwnership(payload, id);
  if ("error" in ownership) return ownership.error;

  // Keep instructor feedback intact. SQLite transactions are serializable by
  // default, so the comment check and parent deletion share one atomic unit.
  const hasMentorFeedback = await db.$transaction(async (tx) => {
    const commentCount = await tx.comment.count({ where: { dailyLogId: id } });
    if (commentCount > 0) return true;

    await tx.dailyLog.delete({ where: { id } });
    return false;
  });

  if (hasMentorFeedback) {
    return NextResponse.json(
      { error: "This check-in has mentor feedback and can't be deleted. Edit the check-in instead to keep the mentoring history." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
