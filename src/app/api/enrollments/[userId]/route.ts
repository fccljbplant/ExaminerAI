import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PATCH /api/enrollments/[userId] — add or remove a course enrollment for a user.
 *  Body: { courseId: string, action: "enroll" | "unenroll", role?: string }
 *  Role defines the enrollment role (default "student"; CourseEnrollment uses
 *  legacy "student"/"instructor" strings, normalized via normalizeRole on read).
 *  Admin (org_admin / platform_admin) only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing enrollments"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN]);
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const { courseId, action, role } = body as {
    courseId?: string;
    action?: "enroll" | "unenroll";
    role?: string;
  };

  if (!courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }
  if (!action || !["enroll", "unenroll"].includes(action)) {
    return NextResponse.json({ error: "action must be 'enroll' or 'unenroll'" }, { status: 400 });
  }

  const targetRole = role || "student";
  if (!["student", "instructor"].includes(targetRole)) {
    return NextResponse.json({ error: "Invalid role for enrollment" }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, name: true } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (action === "enroll") {
    const existing = await db.courseEnrollment.findUnique({
      where: { userId_courseId_role: { userId, courseId, role: targetRole } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already enrolled in this course with this role" }, { status: 409 });
    }
    await db.courseEnrollment.create({
      data: { userId, courseId, role: targetRole },
    });
    await logAudit({
      actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
      action: "enrollment_created",
      target: { type: "user", id: userId },
      after: { courseId, courseName: course.name, role: targetRole },
      metadata: { userName: targetUser.name, userEmail: targetUser.email },
      req,
    }).catch(() => {});
    return NextResponse.json({ ok: true, action: "enrolled", courseId, role: targetRole });
  }

  // Unenroll
  const enrollment = await db.courseEnrollment.findUnique({
    where: { userId_courseId_role: { userId, courseId, role: targetRole } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }
  await db.courseEnrollment.delete({
    where: { id: enrollment.id },
  });
  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: "enrollment_deleted",
    target: { type: "user", id: userId },
    before: { courseId, courseName: course.name, role: targetRole },
    metadata: { userName: targetUser.name, userEmail: targetUser.email },
    req,
  }).catch(() => {});
  return NextResponse.json({ ok: true, action: "unenrolled", courseId });
}
