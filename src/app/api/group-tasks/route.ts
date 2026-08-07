import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, UserRole, hasRole, ADMIN_ROLES, normalizeRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/group-tasks?courseId=X — list group tasks for a course.
 *   - Instructors/admins: see all tasks + submission counts
 *   - Learners: see tasks for their courses + their own submission status
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseIdParam = req.nextUrl.searchParams.get("courseId");

  // Determine which course to query
  let targetCourseId = courseIdParam;
  const isLearner = normalizeRole(user.role) === UserRole.LEARNER;
  if (isLearner) {
    // Learners see tasks for their enrolled courses
    const enrollments = await db.courseEnrollment.findMany({
      where: { userId: user.id, role: "student" },
      select: { courseId: true },
    });
    const courseIds = enrollments.map(e => e.courseId);
    if (courseIds.length === 0) return NextResponse.json({ tasks: [] });
    if (courseIdParam && courseIds.includes(courseIdParam)) {
      targetCourseId = courseIdParam;
    } else {
      targetCourseId = courseIds[0];
    }
  } else {
    // Staff: use the courseId param, or their first course if not provided
    if (!targetCourseId) {
      const enrollment = await db.courseEnrollment.findFirst({
        where: { userId: user.id, role: "instructor" },
        select: { courseId: true },
      });
      targetCourseId = enrollment?.courseId || null;
    }
    if (!targetCourseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  const tasks = await db.groupTask.findMany({
    where: { courseId: targetCourseId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
      submissions: isLearner
        ? { where: { userId: user.id }, select: { id: true, content: true, link: true, score: true, feedback: true, submittedAt: true, gradedAt: true } }
        : false,
    },
  });

  return NextResponse.json({ tasks });
}

/**
 * POST /api/group-tasks — create a new group task (teachers/admins only).
 * Body: { courseId, title, description?, type?, dueDate?, week?, maxScore? }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing group tasks"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { courseId, title, description, type, dueDate, week, maxScore } = body as {
    courseId?: string; title?: string; description?: string;
    type?: string; dueDate?: string; week?: number; maxScore?: number;
  };

  if (!courseId || !title?.trim()) {
    return NextResponse.json({ error: "courseId and title required" }, { status: 400 });
  }

  // Verify instructor can access this course
  if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
    const access = await db.courseEnrollment.findFirst({
      where: { userId: auth.ctx.payload.sub, courseId, role: "instructor" },
    });
    if (!access) {
      return NextResponse.json({ error: "You can only create tasks for courses you are assigned to" }, { status: 403 });
    }
  }

  const task = await db.groupTask.create({
    data: {
      courseId,
      instructorId: auth.ctx.payload.sub,
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
  if (hasRole(payload.role, ADMIN_ROLES)) return { ok: true as const };

  const task = await db.groupTask.findUnique({
    where: { id: taskId },
    select: { instructorId: true, courseId: true },
  });
  if (!task) {
    return { ok: false as const, error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  }
  // Teacher must be the task creator OR have access to the task's course
  if (task.instructorId === payload.sub) return { ok: true as const };
  const access = await db.courseEnrollment.findFirst({
    where: { userId: payload.sub, courseId: task.courseId, role: "instructor" },
  });
  if (!access) {
    return { ok: false as const, error: NextResponse.json({ error: "You can only modify tasks in courses you are assigned to" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing group tasks"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
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
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
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
