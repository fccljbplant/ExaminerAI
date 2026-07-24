import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** PATCH /api/daily-logs/[id] — teacher/admin edits a student's daily check-in.
 *
 *  Body (all optional):
 *    - whatDidYouDo, anyErrors, confidence, gitCommit, week
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
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

/** DELETE /api/daily-logs/[id] — teacher/admin deletes a daily check-in + its comments (cascade). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  // Cascade: delete all comments referencing this check-in first
  await db.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { dailyLogId: id } });
    await tx.dailyLog.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
