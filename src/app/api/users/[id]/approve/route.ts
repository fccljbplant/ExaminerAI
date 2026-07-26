import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { getTeacherBatchIds } from "@/lib/batch-teachers";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PUT /api/users/[id]/approve — approve a pending user. Teacher/admin only.
 *  Demo is read-only and deliberately excluded from this list. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("approving users"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
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

  // Default course selection: when a student is approved without a specific
  // batch assignment, they land in the "Default Batch". We ensure that batch
  // has a courseId set — if not, we link it to whichever course has
  // isDefault=true (or seed the default course on the fly if none exists yet).
  // This way, newly-approved students always have a course to study.
  let defaultBatch = await db.batch.findUnique({ where: { name: "Default Batch" } }).catch(() => null);
  if (defaultBatch && !defaultBatch.courseId) {
    // Find the default course (isDefault=true)
    let defaultCourse = await db.course.findFirst({ where: { isDefault: true } });
    if (!defaultCourse) {
      // No default course yet — fall back to ANY active course in the system.
      // This ensures students get SOMETHING rather than nothing.
      defaultCourse = await db.course.findFirst({ where: { isActive: true } });
    }
    if (defaultCourse) {
      await db.batch.update({
        where: { id: defaultBatch.id },
        data: { courseId: defaultCourse.id },
      }).catch(() => {/* non-fatal */});
    }
  } else if (!defaultBatch) {
    // No Default Batch exists — create one linked to the default course (if any)
    const defaultCourse = await db.course.findFirst({ where: { isDefault: true } })
      || await db.course.findFirst({ where: { isActive: true } });
    defaultBatch = await db.batch.create({
      data: {
        name: "Default Batch",
        description: "Auto-created default batch for students without a specific assignment.",
        courseId: defaultCourse?.id ?? null,
      },
    }).catch(() => null);
  }

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
