import { isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getCourseDurationWeeks } from "@/modules/course/lib/course-db";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit, AuditAction } from "@/lib/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const demoBlock = await demoWriteBlock("editing weekly tests");
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
  const attempt = body.attempt === undefined ? undefined : Number(body.attempt);
  const score = Number(body.score);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  if (!Number.isInteger(week) || week < 1) return NextResponse.json({ error: "A valid course week is required" }, { status: 400 });
  if (attempt !== undefined && (!Number.isInteger(attempt) || attempt < 1)) {
    return NextResponse.json({ error: "attempt must be a positive integer" }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: "Score must be an integer from 0 to 100" }, { status: 400 });
  }
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ error: "A correction reason of 5-500 characters is required" }, { status: 400 });
  }

  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, id);
  if (!authorisedCourseIds.includes(courseId)) {
    return NextResponse.json({ error: "You cannot edit tests for this course" }, { status: 403 });
  }
  const totalWeeks = await getCourseDurationWeeks(id, courseId);
  if (week > totalWeeks) {
    return NextResponse.json({ error: `Week must be between 1 and ${totalWeeks} for this course` }, { status: 400 });
  }

  const existing = await db.weeklyTest.findFirst({
    where: { userId: id, courseId, week, ...(attempt !== undefined ? { attempt } : {}) },
    orderBy: { attempt: "desc" },
  });
  if (!existing) return NextResponse.json({ error: "Weekly test attempt not found in the selected course" }, { status: 404 });
  if (existing.status !== "completed") {
    return NextResponse.json({ error: `Cannot edit an incomplete attempt (status: ${existing.status})` }, { status: 400 });
  }
  if (existing.score === score) {
    return NextResponse.json({ ok: true, message: "The score is unchanged", test: existing });
  }

  const updated = await db.weeklyTest.update({
    where: { id: existing.id },
    data: {
      originalScore: existing.originalScore ?? existing.score,
      score,
      scoreEditedById: payload.sub,
      scoreEditedByRole: payload.role,
      scoreEditedAt: new Date(),
      scoreEditReason: reason,
    },
    select: {
      id: true,
      courseId: true,
      week: true,
      attempt: true,
      score: true,
      originalScore: true,
      scoreEditedAt: true,
      scoreEditReason: true,
      status: true,
    },
  });

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.WEEKLY_TEST_SCORE_UPDATED,
    target: { type: "weekly_test", id: existing.id },
    before: { score: existing.score },
    after: { score: updated.score, originalScore: updated.originalScore },
    metadata: { courseId, week, attempt: existing.attempt, reason },
    req,
  });

  return NextResponse.json({
    ok: true,
    message: `Course ${courseId}, Week ${week}, Attempt ${existing.attempt} updated. The original AI score is retained.`,
    test: updated,
  });
}
