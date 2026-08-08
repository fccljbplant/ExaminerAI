import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** H2 fix (audit 2026-07-26): verify the interaction belongs to a student the
 *  caller can access BEFORE modifying/deleting it. */
async function verifyInteractionOwnership(payload: { sub: string; role: string; email: string; name: string }, interactionId: string) {
  const interaction = await db.interaction.findUnique({
    where: { id: interactionId },
    select: { userId: true },
  });
  if (!interaction) {
    return { error: NextResponse.json({ error: "Interaction not found" }, { status: 404 }) };
  }
  try {
    await assertCanAccessStudent(payload, interaction.userId);
  } catch (err) {
    return { error: NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 }) };
  }
  return { userId: interaction.userId };
}

/** PATCH /api/interactions/[id] — instructor/admin edits a practice question record.
 *
 *  Body (all optional):
 *    - correctness (0-100), feedback, level, topic, question, studentAnswer
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing interactions"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  // H2 fix: verify ownership before updating
  const ownership = await verifyInteractionOwnership(payload, id);
  if ("error" in ownership) return ownership.error;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.correctness !== undefined) {
    const val = Number(body.correctness);
    if (val < 0 || val > 100) return NextResponse.json({ error: "Score must be 0-100" }, { status: 400 });
    data.correctness = val;
  }
  if (body.feedback !== undefined) data.feedback = String(body.feedback);
  if (body.level !== undefined) data.level = String(body.level);
  if (body.topic !== undefined) data.topic = String(body.topic);
  if (body.question !== undefined) data.question = String(body.question);
  if (body.studentAnswer !== undefined) data.studentAnswer = String(body.studentAnswer);

  const interaction = await db.interaction.update({ where: { id }, data });
  return NextResponse.json({ interaction });
}

/** DELETE /api/interactions/[id] — instructor/admin deletes a practice question + its comments (cascade). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing interactions"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  // H2 fix: verify ownership before deleting
  const ownership = await verifyInteractionOwnership(payload, id);
  if ("error" in ownership) return ownership.error;

  // Cascade: delete all comments referencing this interaction first
  await db.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { interactionId: id } });
    await tx.interaction.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
