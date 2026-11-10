import { isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit, AuditAction } from "@/lib/audit-log";

async function authoriseCourse(payload: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>, learnerId: string, courseId: string, week: number) {
  try {
    await assertCanAccessStudent(payload, learnerId, "content_only");
  } catch (err) {
    return { response: NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 }) };
  }
  const courseIds = await getStaffAuthorizedStudentCourseIds(payload, learnerId);
  if (!courseIds.includes(courseId)) {
    return { response: NextResponse.json({ error: "You cannot manage tests for this course" }, { status: 403 }) };
  }
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, weeks: { select: { weekNumber: true } } },
  });
  if (!course) return { response: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
  if (!course.weeks.some((courseWeek) => courseWeek.weekNumber === week)) {
    return { response: NextResponse.json({ error: "Week is not part of the selected course outline" }, { status: 400 }) };
  }
  return { response: null };
}

/** POST /api/students/[id]/allow-retake — grant one retake for a course/week. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const demoBlock = await demoWriteBlock("allowing retakes");
  if (demoBlock) return demoBlock;
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const week = Number(body.week);
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const access = await authoriseCourse(payload, id, courseId, week);
  if (access.response) return access.response;

  const existing = await db.weeklyTest.findFirst({
    where: { userId: id, courseId, week },
    orderBy: { attempt: "desc" },
  });
  if (!existing) {
    return NextResponse.json({ error: `No Week ${week} test exists in the selected course yet. Use Unlock Test instead.` }, { status: 404 });
  }
  if (existing.status !== "completed") {
    return NextResponse.json({ error: `Week ${week} attempt ${existing.attempt} is not completed.` }, { status: 400 });
  }

  await db.weeklyTest.update({
    where: { id: existing.id },
    data: { retakeAllowed: true },
  });
  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.WEEKLY_TEST_RETAKE_ALLOWED,
    target: { type: "weekly_test", id: existing.id },
    after: { courseId, week, attempt: existing.attempt, retakeAllowed: true },
    req,
  });

  return NextResponse.json({
    ok: true,
    message: `One retake allowed for ${existing.courseId} · Week ${week}. The completed attempt remains preserved.`,
    attempt: existing.attempt,
  });
}

/** DELETE /api/students/[id]/allow-retake?courseId=...&week=... — revoke the latest attempt's permission. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const demoBlock = await demoWriteBlock("revoking retakes");
  if (demoBlock) return demoBlock;
  const payload = await getAuthUser();
  if (!payload || !isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const courseId = req.nextUrl.searchParams.get("courseId")?.trim() ?? "";
  const week = Number(req.nextUrl.searchParams.get("week") ?? "0");
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const access = await authoriseCourse(payload, id, courseId, week);
  if (access.response) return access.response;

  const existing = await db.weeklyTest.findFirst({
    where: { userId: id, courseId, week },
    orderBy: { attempt: "desc" },
  });
  if (!existing) return NextResponse.json({ error: "No matching course weekly-test attempt found" }, { status: 404 });
  if (!existing.retakeAllowed) {
    return NextResponse.json({ error: "Retake is not currently allowed for this course attempt" }, { status: 400 });
  }

  await db.weeklyTest.update({ where: { id: existing.id }, data: { retakeAllowed: false } });
  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.WEEKLY_TEST_RETAKE_REVOKED,
    target: { type: "weekly_test", id: existing.id },
    after: { courseId, week, attempt: existing.attempt, retakeAllowed: false },
    req,
  });

  return NextResponse.json({ ok: true, message: `Retake permission revoked for course week ${week}.` });
}
