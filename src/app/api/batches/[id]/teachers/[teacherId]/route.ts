import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { canAccessBatch } from "@/lib/batch-teachers";

/** DELETE /api/batches/[id]/teachers/[teacherId] — remove a teacher from a batch.
 *  Same permission rule as POST: ADMIN_ROLES or existing batch teacher. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teacherId: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batchId, teacherId } = await params;

  // Permission: admin OR existing batch teacher
  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  if (!isAdmin) {
    const canAccess = await canAccessBatch(payload.sub, payload.role, batchId);
    if (!canAccess) return NextResponse.json({ error: "Only admins or existing batch teachers can remove teachers" }, { status: 403 });
  }

  await db.batchTeacher.deleteMany({
    where: { batchId, teacherId },
  });

  return NextResponse.json({ ok: true });
}
