import { isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit, AuditAction } from "@/lib/audit-log";

/** POST /api/students/[id]/unlock-test — unlock or reset one course/week attempt. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const demoBlock = await demoWriteBlock("unlocking tests");
  if (demoBlock) return demoBlock;
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await assertCanAccessStudent(payload, id, "content_only");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const week = Number(body.week);
  const action = body.action === "reset" ? "reset" : "unlock";
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  if (!Number.isInteger(week) || week < 1) {
    return NextResponse.json({ error: "A valid course week is required" }, { status: 400 });
  }

  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, id);
  if (!authorisedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot unlock tests for this course" }, { status: 403 });
  }
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, weeks: { select: { weekNumber: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (!course.weeks.some((courseWeek) => courseWeek.weekNumber === week)) {
    return NextResponse.json({ error: "Week is not part of the selected course outline" }, { status: 400 });
  }

  const [student, existing] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } }),
    db.weeklyTest.findFirst({
      where: { userId: id, courseId, week },
      orderBy: { attempt: "desc" },
    }),
  ]);
  if (!student || !["learner", "student"].includes(student.role)) {
    return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  }

  if (existing?.status === "completed") {
    return NextResponse.json(
      { error: "This course-week test is already completed. Use Allow Retake to create a new attempt." },
      { status: 400 },
    );
  }

  let attempt: number;
  let auditTestId = existing?.id ?? id;
  if (existing && action === "unlock" && existing.status !== "abandoned") {
    await db.weeklyTest.update({
      where: { id: existing.id },
      data: { status: "in-progress", startedAt: existing.startedAt ?? new Date() },
    });
    attempt = existing.attempt;
  } else {
    if (existing) {
      // Preserve the old conversation and any linked comments; never delete an attempt.
      await db.weeklyTest.update({
        where: { id: existing.id },
        data: { status: "abandoned", retakeAllowed: false },
      });
    }
    attempt = (existing?.attempt ?? 0) + 1;
    const created = await db.weeklyTest.create({
      data: {
        userId: id,
        courseId,
        week,
        attempt,
        status: "in-progress",
        startedAt: new Date(),
      },
      select: { id: true },
    });
    auditTestId = created.id;
  }

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.WEEKLY_TEST_UNLOCKED,
    target: { type: "weekly_test", id: auditTestId },
    after: { courseId, week, attempt, action },
    req,
  });

  return NextResponse.json({
    ok: true,
    message: `Week ${week} unlocked for ${student.name} in the selected course. Attempt ${attempt} is ready.`,
    courseId,
    week,
    attempt,
  });
}
