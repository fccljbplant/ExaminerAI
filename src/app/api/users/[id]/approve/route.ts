import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PUT /api/users/[id]/approve — approve a pending-status user. Instructor/admin only.
 *  Demo is read-only and deliberately excluded from this list. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("approving users"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([
    UserRole.INSTRUCTOR,
    UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { courseId } = body as { courseId?: string };

  const target = await db.user.findUnique({ where: { id }, select: { role: true, name: true, email: true, status: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  // `pending` is now a User.status, not a role. Treat legacy role="pending"
  // rows the same as status="pending". Approval promotes the user to learner.
  const isPending = target.status === "pending" || target.role === "pending";
  if (!isPending) {
    return NextResponse.json({ error: `Cannot approve: user is already ${target.role}` }, { status: 400 });
  }

  // Multi-teacher: teachers can only approve users who will be enrolled in
  // their courses. Admins can approve anyone.
  if (!hasRole(auth.ctx.payload.role, ADMIN_ROLES)) {
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: auth.ctx.payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    if (instructorCourses.length === 0) {
      return NextResponse.json({ error: "You are not assigned to any course" }, { status: 403 });
    }
  }

  // Enroll the student — use provided courseId or fall back to default course
  let targetCourseId = courseId;
  if (!targetCourseId) {
    const defaultCourse = await db.course.findFirst({ where: { isDefault: true } })
      || await db.course.findFirst({ where: { isActive: true } });
    if (defaultCourse) targetCourseId = defaultCourse.id;
  }

  // Verify the course exists if a specific one was requested
  if (targetCourseId) {
    const course = await db.course.findUnique({ where: { id: targetCourseId }, select: { id: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
  }

  // Update user role to learner + status to active
  const user = await db.user.update({
    where: { id },
    data: { role: "learner", status: "active", approvedAt: new Date() },
  });

  // Create CourseEnrollment
  if (targetCourseId) {
    await db.courseEnrollment.create({
      data: {
        userId: id,
        courseId: targetCourseId,
        role: "student",
      },
    }).catch(() => {/* non-fatal — user is still approved */});
  }

  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: AuditAction.USER_APPROVED, target: { type: "user", id },
    before: { role: "pending", name: target.name, email: target.email },
    after: { role: "learner", name: target.name, email: target.email }, req,
  });

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
