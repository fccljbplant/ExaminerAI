import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * PATCH /api/users/[id]/batch — assign a student to a batch.
 * Admin/principal only.
 *
 * Body: { batchId: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("assigning batches"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { batchId } = body as { batchId?: string };

  if (!batchId) {
    return NextResponse.json({ error: "batchId required" }, { status: 400 });
  }

  // Verify the batch exists (HI-10 fix: also fetch course.institutionId for scoping)
  const batch = await db.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, courseId: true, course: { select: { institutionId: true } } },
  });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Get the user's current batchId for audit (HI-10 fix: also fetch institutionId)
  const before = await db.user.findUnique({
    where: { id },
    select: { batchId: true, name: true, email: true, role: true, institutionId: true },
  });
  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // HI-10 fix: principals can only assign batches within their own institution
  if (auth.ctx.payload.role === "principal") {
    const caller = await db.user.findUnique({ where: { id: auth.ctx.payload.sub }, select: { institutionId: true } });
    if (caller?.institutionId) {
      // Check that the batch's course is in the same institution
      if (batch.course?.institutionId && batch.course.institutionId !== caller.institutionId) {
        return NextResponse.json({ error: "You can only assign batches in your own institution" }, { status: 403 });
      }
      // Check that the target user is in the same institution
      if (before.institutionId && before.institutionId !== caller.institutionId) {
        return NextResponse.json({ error: "You can only modify users in your own institution" }, { status: 403 });
      }
    }
  }

  // Update the user's batch
  const user = await db.user.update({
    where: { id },
    data: { batchId },
    select: { id: true, name: true, email: true, role: true, batchId: true },
  });

  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: "batch_assigned",
    target: { type: "user", id },
    before: { batchId: before.batchId },
    after: { batchId, batchName: batch.name },
    metadata: { userName: before.name, userEmail: before.email },
    req,
  }).catch(() => {});

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, batchId: user.batchId },
    batch: { id: batch.id, name: batch.name, courseId: batch.courseId },
  });
}
