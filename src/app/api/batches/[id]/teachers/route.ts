import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { canAccessBatch } from "@/lib/batch-teachers";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/batches/[id]/teachers — add a teacher to a batch.
 *  Allowed for ADMIN_ROLES, or for a teacher who already has a BatchTeacher
 *  row on that same batch (so an existing batch teacher can add a co-teacher). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing batch teachers"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batchId } = await params;
  const body = await req.json().catch(() => ({}));
  const { teacherId } = body as { teacherId?: string };

  if (!teacherId) return NextResponse.json({ error: "teacherId required" }, { status: 400 });

  // Permission: admin OR existing batch teacher
  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  if (!isAdmin) {
    const canAccess = await canAccessBatch(payload.sub, payload.role, batchId);
    if (!canAccess) return NextResponse.json({ error: "Only admins or existing batch teachers can add teachers" }, { status: 403 });
  }

  // Verify the teacher exists and is a staff role
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  const staffRoles = ["teacher", "course_coordinator", "counselor"];
  if (!staffRoles.includes(teacher.role) && !hasRole(teacher.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "User is not a staff member" }, { status: 400 });
  }

  // Verify the batch exists
  const batch = await db.batch.findUnique({ where: { id: batchId }, select: { id: true, name: true } });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  // Create the BatchTeacher row (upsert to handle duplicates gracefully)
  const membership = await db.batchTeacher.upsert({
    where: { batchId_teacherId: { batchId, teacherId } },
    create: { batchId, teacherId },
    update: {}, // no-op if already exists
  });

  return NextResponse.json({ ok: true, batchId, teacherId, teacher: { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role } });
}

/** GET /api/batches/[id]/teachers — list all teachers on a batch. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batchId } = await params;

  const teachers = await db.batchTeacher.findMany({
    where: { batchId },
    include: {
      teacher: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { teacher: { name: "asc" } },
  });

  return NextResponse.json({
    teachers: teachers.map(t => ({
      id: t.id,
      batchId: t.batchId,
      teacherId: t.teacherId,
      teacher: t.teacher,
    })),
  });
}
