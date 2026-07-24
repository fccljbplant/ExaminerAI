import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { canAccessBatch } from "@/lib/batch-teachers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** PATCH /api/batches/[id] — update a batch.
 *
 *  Supported fields (all optional, only fields present in the body are updated):
 *    - name?: string           (must remain unique)
 *    - description?: string
 *    - startDate?: string | null (ISO date)
 *    - endDate?: string | null   (ISO date)
 *    - courseId?: string | null  (assign/unassign a course outline)
 *
 *  Assigning a course is the most common use case — it's called by the
 *  CoursePlanner UI when an admin/teacher toggles a batch chip on/off.
 *  Passing `courseId: null` UNASSIGNS the course from the batch.
 *
 *  Admins can edit any batch. Teachers can also assign/unassign courses
 *  (they need this to manage their own batches) but cannot rename or
 *  delete batches — that stays admin-only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, description, startDate, endDate, courseId } = body as {
    name?: string;
    description?: string;
    startDate?: string | null;
    endDate?: string | null;
    courseId?: string | null;
  };

  // Verify batch exists
  const existing = await db.batch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // H9-rel: teachers can only modify their own batch. Admins can modify any.
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    const canAccess = await canAccessBatch(payload.sub, payload.role, id);
    if (!canAccess) {
      return NextResponse.json({ error: "You can only modify batches you are assigned to" }, { status: 403 });
    }
  }

  // Teachers, TAs, course_coordinators, and counselors can only update the
  // courseId field — name/description/dates are admin-only. Only ADMIN_ROLES
  // (principal, administrator) can edit batch metadata freely.
  const isTeacherOnly = (payload.role === "teacher"  || payload.role === "course_coordinator" || payload.role === "counselor");
  const teacherBlockedFields: string[] = [];
  if (isTeacherOnly) {
    if (name !== undefined && name !== existing.name) teacherBlockedFields.push("name");
    if (description !== undefined && description !== existing.description) teacherBlockedFields.push("description");
    if (startDate !== undefined) teacherBlockedFields.push("startDate");
    if (endDate !== undefined) teacherBlockedFields.push("endDate");
    if (teacherBlockedFields.length > 0) {
      return NextResponse.json(
        { error: `Your role can only assign/unassign courses. Admin-only fields attempted: ${teacherBlockedFields.join(", ")}` },
        { status: 403 }
      );
    }
  }

  // Build update payload
  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Batch name cannot be empty" }, { status: 400 });
    }
    if (trimmed !== existing.name) {
      // Check for duplicate name (case-sensitive — Prisma uses the @unique constraint on `name`)
      const clash = await db.batch.findUnique({ where: { name: trimmed } });
      if (clash && clash.id !== id) {
        return NextResponse.json({ error: "A batch with this name already exists" }, { status: 409 });
      }
    }
    data.name = trimmed;
  }

  if (description !== undefined) {
    data.description = description.trim();
  }

  if (startDate !== undefined) {
    data.startDate = startDate ? new Date(startDate) : null;
  }

  if (endDate !== undefined) {
    data.endDate = endDate ? new Date(endDate) : null;
  }

  if (courseId !== undefined) {
    // null = unassign course; non-null = must reference an existing, active course
    if (courseId === null) {
      data.courseId = null;
    } else {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { id: true, isActive: true },
      });
      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      if (!course.isActive) {
        return NextResponse.json({ error: "Cannot assign an inactive course" }, { status: 400 });
      }
      data.courseId = courseId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update — provide name, description, startDate, endDate, or courseId" }, { status: 400 });
  }

  const updated = await db.batch.update({
    where: { id },
    data,
    include: { course: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    ok: true,
    batch: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      startDate: updated.startDate,
      endDate: updated.endDate,
      courseId: updated.courseId,
      courseName: updated.course?.name ?? null,
    },
  });
}

/** GET /api/batches/[id] — fetch a single batch (admin/teacher only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const batch = await db.batch.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, name: true } },
      _count: { select: { users: true } },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({
    batch: {
      id: batch.id,
      name: batch.name,
      description: batch.description,
      startDate: batch.startDate,
      endDate: batch.endDate,
      courseId: batch.courseId,
      courseName: batch.course?.name ?? null,
      totalMembers: batch._count.users,
      createdAt: batch.createdAt,
    },
  });
}
