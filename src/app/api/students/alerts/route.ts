import { isStaffRole, ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/students/alerts — returns open alerts for students in the teacher's batch.
 *  Also returns the StudentHealthSummary for each student with alerts.
 *  Staff-only. Safeguarding alerts (type="safeguarding") are principal-only. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPrincipal = hasRole(payload.role, ADMIN_ROLES);
  const url = new URL(req.url);
  const studentId = url.searchParams.get("userId");

  if (studentId) {
    // IDOR protection: verify the caller can access this student
    if (payload.sub !== studentId) {
      try {
        await assertCanAccessStudent(payload, studentId);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
      }
    }

    // Get alerts for a specific student
    // Filter safeguarding alerts to principal-only
    const alertWhere: any = { userId: studentId, status: "open" };
    if (!isPrincipal) {
      alertWhere.type = { not: "safeguarding" };
    }
    const alerts = await db.studentAlert.findMany({
      where: alertWhere,
      orderBy: { createdAt: "desc" },
    });
    const summary = await db.studentHealthSummary.findUnique({
      where: { userId: studentId },
    });
    return NextResponse.json({ alerts, summary });
  }

  // Get all open alerts across all students (for teacher dashboard)
  // Scope to the caller's enrolled students via CourseEnrollment
  let accessibleStudentIds: string[] | undefined;
  if (!isPrincipal) {
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    const courseIds = instructorCourses.map(c => c.courseId);
    if (courseIds.length > 0) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: courseIds }, role: "student" },
        select: { userId: true },
      });
      accessibleStudentIds = enrollments.map(e => e.userId);
    } else {
      accessibleStudentIds = [];
    }
  }
  const alertWhere: any = {
    status: "open",
    user: {
      role: "student",
      blocked: false,
      ...(accessibleStudentIds !== undefined ? { id: { in: accessibleStudentIds } } : {}),
    },
  };
  if (!isPrincipal) {
    alertWhere.type = { not: "safeguarding" };
  }
  const alerts = await db.studentAlert.findMany({
    where: alertWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ alerts });
}

/** PATCH /api/students/alerts — resolve or acknowledge an alert.
 *  Body: { alertId, status, resolutionNote? } */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing alerts"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { alertId, status, resolutionNote } = body as {
    alertId?: string; status?: string; resolutionNote?: string;
  };

  if (!alertId || !status) {
    return NextResponse.json({ error: "alertId and status required" }, { status: 400 });
  }

  const alert = await db.studentAlert.update({
    where: { id: alertId },
    data: {
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
      resolvedBy: payload.sub,
      resolutionNote: resolutionNote || null,
    },
  });

  // If resolved, clear the alert flag on the summary
  if (status === "resolved") {
    const updateData: Record<string, unknown> = {};
    if (alert.type === "psychological") updateData.needsPsychAlert = false;
    if (alert.type === "educational") updateData.needsEducationalAlert = false;
    if (alert.type === "mentorship") updateData.needsMentorshipAlert = false;
    await db.studentHealthSummary.update({
      where: { userId: alert.userId },
      data: updateData,
    }).catch(() => {/* non-blocking */});
  }

  return NextResponse.json({ ok: true, alert });
}
