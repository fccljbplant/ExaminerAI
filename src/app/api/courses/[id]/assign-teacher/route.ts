import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** POST /api/courses/[id]/assign-teacher — assign or unassign a teacher for this course.
 *
 *  Body: { teacherId: string | null }
 *    - string: assign this user (must have role=teacher)
 *    - null:   unassign the current teacher
 *
 *  Auth: staff only (course_coordinator, admin, principal).
 *
 *  The teacher is the human owner of the course plan. Students can't be
 *  enrolled in a course until a teacher is assigned (enforced on the
 *  student-assignment routes via assertCourseHasTeacher).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { teacherId } = body as { teacherId?: string | null };

  // Verify the course exists
  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, name: true, teacherId: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // null/empty = unassign
  if (!teacherId) {
    await db.course.update({
      where: { id },
      data: { teacherId: null },
    });
    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "course_assign_teacher",
      target: { type: "course", id },
      after: { courseName: course.name, teacherId: null, action: "unassign" },
      req,
    }).catch(() => {});
    return NextResponse.json({ ok: true, teacher: null });
  }

  // Verify the target user exists + is a teacher
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }
  if (teacher.role !== "teacher") {
    return NextResponse.json(
      { error: `User "${teacher.name}" is not a teacher (role: ${teacher.role}).` },
      { status: 400 }
    );
  }

  await db.course.update({
    where: { id },
    data: { teacherId },
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: "course_assign_teacher",
    target: { type: "course", id },
    after: { courseName: course.name, teacherId, teacherName: teacher.name },
    req,
  }).catch(() => {});

  logger.info("Course teacher assigned", { courseId: id, teacherId, by: payload.sub });

  return NextResponse.json({
    ok: true,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
  });
}
