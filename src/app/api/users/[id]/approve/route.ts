import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { getTeacherBatchIds } from "@/lib/batch-teachers";

/** PUT /api/users/[id]/approve — approve a pending user. Teacher/admin only. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id }, select: { role: true, name: true, email: true, batchId: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role !== "pending") {
    return NextResponse.json({ error: `Cannot approve: user is already ${target.role}` }, { status: 400 });
  }

  // Multi-teacher: teachers can only approve users whose batchId is in
  // their BatchTeacher membership list. Admins can approve anyone.
  const { hasRole, ADMIN_ROLES } = await import("@/lib/rbac");
  if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
    const teacherBatchIds = await getTeacherBatchIds(auth.ctx.payload.sub, auth.ctx.payload.role);
    if (teacherBatchIds !== null) { // null = admin (unrestricted)
      if (teacherBatchIds.length === 0) {
        return NextResponse.json({ error: "You are not assigned to any batch" }, { status: 403 });
      }
      // If the target has a batchId, it must be in the teacher's batch list
      // If the target has no batchId (null), they'll be assigned to the default batch
      if (target.batchId && !teacherBatchIds.includes(target.batchId)) {
        return NextResponse.json({ error: "You can only approve users in your batch" }, { status: 403 });
      }
    }
  }

  const defaultBatch = await db.batch.findUnique({ where: { name: "Default Batch" } }).catch(() => null);
  const updateData: { role: string; approvedAt: Date; batchId?: string } = { role: "student", approvedAt: new Date() };
  if (defaultBatch && !target.batchId) updateData.batchId = defaultBatch.id;

  const user = await db.user.update({ where: { id }, data: updateData });

  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: AuditAction.USER_APPROVED, target: { type: "user", id },
    before: { role: "pending", name: target.name, email: target.email },
    after: { role: "student", name: target.name, email: target.email }, req,
  });

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
