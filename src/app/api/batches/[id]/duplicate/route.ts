import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/batches/[id]/duplicate — create a new batch from an existing one.
 *
 *  Copies: courseId, deliveryMode, and all BatchTeacher rows.
 *  Does NOT copy: students, test/progress history, tasks, events.
 *  The new batch is a fresh intake shell with the same course + teachers.
 *
 *  Body: { name, startDate }
 *  Allowed: ADMIN_ROLES or any staff who can access the source batch.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("duplicating batches"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sourceBatchId } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, startDate } = body as { name?: string; startDate?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Fetch the source batch
  const sourceBatch = await db.batch.findUnique({
    where: { id: sourceBatchId },
    select: {
      id: true,
      name: true,
      courseId: true,
      deliveryMode: true,
      description: true,
    },
  });
  if (!sourceBatch) return NextResponse.json({ error: "Source batch not found" }, { status: 404 });

  // Check for duplicate name
  const existing = await db.batch.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "A batch with this name already exists" }, { status: 409 });

  // Fetch source batch's teachers
  const sourceTeachers = await db.batchTeacher.findMany({
    where: { batchId: sourceBatchId },
    select: { teacherId: true },
  });

  // Create the new batch
  const newBatch = await db.batch.create({
    data: {
      name: name.trim(),
      description: sourceBatch.description,
      courseId: sourceBatch.courseId,
      deliveryMode: sourceBatch.deliveryMode,
      startDate: startDate ? new Date(startDate) : null,
    },
  });

  // Copy all BatchTeacher rows from source to new batch
  if (sourceTeachers.length > 0) {
    await db.batchTeacher.createMany({
      data: sourceTeachers.map(t => ({
        batchId: newBatch.id,
        teacherId: t.teacherId,
      })) as Array<{ batchId: string; teacherId: string }>,
    });
  }

  return NextResponse.json({
    ok: true,
    batch: {
      id: newBatch.id,
      name: newBatch.name,
      courseId: newBatch.courseId,
      deliveryMode: newBatch.deliveryMode,
      startDate: newBatch.startDate,
      teachersCopied: sourceTeachers.length,
    },
  });
}
