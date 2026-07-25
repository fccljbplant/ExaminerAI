import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/users/batch-approve — approve multiple pending users at once. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("batch-approving users"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { userIds } = body as { userIds?: string[] };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds must be a non-empty array" }, { status: 400 });
  }
  if (userIds.length > 50) {
    return NextResponse.json({ error: "Cannot approve more than 50 users at once" }, { status: 400 });
  }

  const defaultBatch = await db.batch.findUnique({ where: { name: "Default Batch" } }).catch(() => null);
  const approved: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of userIds) {
    try {
      const target = await db.user.findUnique({ where: { id }, select: { role: true, batchId: true, name: true, email: true } });
      if (!target) { skipped.push({ id, reason: "User not found" }); continue; }
      if (target.role !== "pending") { skipped.push({ id, reason: `Already ${target.role}` }); continue; }
      // H9-security: teachers can only approve users in their batch.
      // R11-fix: null !== null is false, which would let legacy teachers
      // approve any legacy user. Explicitly require both to be non-null
      // and equal, OR both null (same legacy pool).
      // N6-fix: also handle the edge case where approver is null (deleted
      // between auth and lookup) — skip instead of falling through.
      if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
        const approver = await db.user.findUnique({ where: { id: auth.ctx.payload.sub }, select: { batchId: true } });
        if (!approver) {
          skipped.push({ id, reason: "Could not verify your batch" });
          continue;
        }
        // If approver has a batch, target must match. If approver has
        // no batch (legacy), they can only approve other legacy users
        // (both null) — not users assigned to a specific batch.
        if (approver.batchId) {
          if (target.batchId !== approver.batchId) {
            skipped.push({ id, reason: "Not in your batch" });
            continue;
          }
        } else if (target.batchId) {
          // Legacy approver trying to approve a user in a specific batch
          skipped.push({ id, reason: "Not in your batch" });
          continue;
        }
      }
      await db.user.update({
        where: { id },
        data: {
          role: "student",
          approvedAt: new Date(),
          ...(defaultBatch && !target.batchId ? { batchId: defaultBatch.id } : {}),
        },
      });
      approved.push(id);
      await logAudit({
        actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
        action: AuditAction.USER_APPROVED,
        target: { type: "user", id },
        before: { role: "pending", name: target.name, email: target.email },
        after: { role: "student", name: target.name, email: target.email },
        metadata: { batchOperation: true },
        req,
      });
    } catch (err) {
      logger.warn("Batch approve: individual user failed", { userId: id, error: err instanceof Error ? err.message : String(err) });
      skipped.push({ id, reason: "Database error" });
    }
  }
  return NextResponse.json({ approved, skipped });
}
