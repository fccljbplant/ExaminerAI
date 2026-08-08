import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getCourseDurationWeeks } from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** POST /api/students/[id]/unlock-test — instructor/admin unlocks a week's test
 *  for a student, bypassing the task-completion requirement.
 *
 *  Body: { week: number, action?: "unlock" | "reset" }
 *
 *  - "unlock" (default): If no test exists, create one in "in-progress" state
 *    so the student can immediately start it. If a test exists and is in
 *    "locked" state, mark it "in-progress".
 *  - "reset": Clear any in-progress test and create a fresh one. Use this
 *    when a student's test is stuck or corrupted.
 *
 *  This does NOT touch completed tests — for those, use /allow-retake instead.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("unlocking tests"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // IDOR protection: verify the caller can access this student's data
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { week, action } = body as { week?: number; action?: "unlock" | "reset" };
  const act = action === "reset" ? "reset" : "unlock";

  // Look up the student's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(id);
  if (!week || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `Valid week (1-${totalWeeks}) required` }, { status: 400 });
  }

  const student = await db.user.findUnique({ where: { id } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const existing = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: id, week } },
  });

  if (existing?.status === "completed") {
    return NextResponse.json(
      { error: `Week ${week} test is already completed. Use "Allow Retake" instead to let the student retake it.` },
      { status: 400 }
    );
  }

  if (act === "reset" && existing) {
    // Cascade: delete all comments referencing this weekly test first
    await db.comment.deleteMany({ where: { weeklyTestId: existing.id } });
    await db.weeklyTest.delete({ where: { id: existing.id } });
  } else if (existing) {
    // Test exists but is locked/in-progress — just mark it in-progress so
    // the student can continue without task-lock blocking.
    await db.weeklyTest.update({
      where: { id: existing.id },
      data: { status: "in-progress", startedAt: existing.startedAt ?? new Date() },
    });
    return NextResponse.json({
      ok: true,
      message: `Week ${week} test unlocked for ${student.name}. They can now take it.`,
    });
  }

  // No existing test — create a fresh in-progress one
  await db.weeklyTest.create({
    data: {
      userId: id,
      week,
      status: "in-progress",
      startedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Week ${week} test unlocked for ${student.name}. They can now take it.`,
  });
}
