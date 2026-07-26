import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/group-tasks?batchId=X — list group tasks for a batch.
 *   - Teachers/admins: see all tasks + submission counts
 *   - Students: see tasks for their batch + their own submission status
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batchId = req.nextUrl.searchParams.get("batchId");

  // Determine which batch to query
  let targetBatchId = batchId;
  if (user.role === "student" || user.role === "pending") {
    // Students see tasks for their own batch only
    targetBatchId = user.batchId;
    if (!targetBatchId) return NextResponse.json({ tasks: [] });
  } else {
    // Staff: use the batchId param, or their own batch if not provided
    if (!targetBatchId && user.batchId) targetBatchId = user.batchId;
    if (!targetBatchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });
  }

  const tasks = await db.groupTask.findMany({
    where: { batchId: targetBatchId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
      submissions: user.role === "student" || user.role === "pending"
        ? { where: { userId: user.id }, select: { id: true, content: true, link: true, score: true, feedback: true, submittedAt: true, gradedAt: true } }
        : false,
    },
  });

  return NextResponse.json({ tasks });
}

/**
 * POST /api/group-tasks — create a new group task (teachers/admins only).
 * Body: { batchId, title, description?, type?, dueDate?, week?, maxScore? }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing group tasks"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { batchId, title, description, type, dueDate, week, maxScore } = body as {
    batchId?: string; title?: string; description?: string;
    type?: string; dueDate?: string; week?: number; maxScore?: number;
  };

  if (!batchId || !title?.trim()) {
    return NextResponse.json({ error: "batchId and title required" }, { status: 400 });
  }

  // H10-rel: batch ownership check — teachers can only create tasks for
  // their own batch. Admins can create for any batch.
  if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
    const teacher = await db.user.findUnique({
      where: { id: auth.ctx.payload.sub },
      select: { batchId: true },
    });
    const canAccess = await canAccessBatch(auth.ctx.payload.sub, auth.ctx.payload.role, batchId);
    if (!canAccess) {
      return NextResponse.json({ error: "You can only create tasks for batches you are assigned to" }, { status: 403 });
    }
  }

  const task = await db.groupTask.create({
    data: {
      batchId,
      teacherId: auth.ctx.payload.sub,
      title: title.trim(),
      description: description?.trim() || "",
      type: type || "assignment",
      dueDate: dueDate ? new Date(dueDate) : null,
      week: week ?? null,
      maxScore: maxScore ?? 100,
    },
  });

  return NextResponse.json({ task });
}

/**
 * PATCH /api/group-tasks — update a group task (close/grade/edit).
 * Body: { taskId, status?, title?, description?, dueDate? }
 *
 * H2 fix (audit 2026-07-26): teachers can only modify tasks they own (or in
 * batches they can access). Admins can modify any task.
 */
async function verifyGroupTaskOwnership(payload: { sub: string; role: string }, taskId: string) {
  // Admins can access any task
  const { hasRole, ADMIN_ROLES } = await import("@/lib/rbac");
  if (hasRole(payload.role, ADMIN_ROLES)) return { ok: true as const };

  const task = await db.groupTask.findUnique({
    where: { id: taskId },
    select: { teacherId: true, batchId: true },
  });
  if (!task) {
    return { ok: false as const, error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  }
  // Teacher must be the task creator OR have access to the task's batch
  if (task.teacherId === payload.sub) return { ok: true as const };
  const { canAccessBatch } = await import("@/lib/batch-teachers");
  const canAccess = await canAccessBatch(payload.sub, payload.role, task.batchId);
  if (!canAccess) {
    return { ok: false as const, error: NextResponse.json({ error: "You can only modify tasks in batches you are assigned to" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing group tasks"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { taskId, status, title, description, dueDate } = body as {
    taskId?: string; status?: string; title?: string; description?: string; dueDate?: string;
  };

  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  // H2 fix: verify ownership before updating
  const ownership = await verifyGroupTaskOwnership(auth.ctx.payload, taskId);
  if (!ownership.ok) return ownership.error;

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

  const task = await db.groupTask.update({
    where: { id: taskId },
    data: updateData,
  });

  return NextResponse.json({ task });
}

/**
 * DELETE /api/group-tasks — delete a group task.
 * Body: { taskId }
 *
 * H2 fix (audit 2026-07-26): teachers can only delete tasks they own (or in
 * batches they can access). Admins can delete any task.
 */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing group tasks"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { taskId } = body as { taskId?: string };
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  // H2 fix: verify ownership before deleting
  const ownership = await verifyGroupTaskOwnership(auth.ctx.payload, taskId);
  if (!ownership.ok) return ownership.error;

  await db.groupTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
