import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getCourseDurationWeeks } from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/students/[id]/allow-retake — teacher/admin explicitly allows a
 *  student to retake a completed weekly test.
 *
 *  Body: { week: number }
 *
 *  Sets `retakeAllowed = true` on the existing WeeklyTest row. The student
 *  will then see a "Retake Test" button on the completed test results card.
 *  When they start the retake, the flag is cleared and the test is reset.
 *
 *  If no test exists yet (e.g. student hasn't taken it), returns 404 — the
 *  teacher should instead use the "Unlock Test" endpoint to create one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("allowing retakes"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // IDOR protection: verify the caller can access this student's data
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { week } = body as { week?: number };

  // Look up the student's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(id);
  if (!week || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `Valid week (1-${totalWeeks}) required` }, { status: 400 });
  }

  const existing = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: id, week } },
  });

  if (!existing) {
    return NextResponse.json(
      { error: `Student hasn't taken Week ${week} test yet. Use "Unlock Test" instead.` },
      { status: 404 }
    );
  }

  if (existing.status !== "completed") {
    return NextResponse.json(
      { error: `Week ${week} test isn't completed yet (status: ${existing.status}). Student can already continue it.` },
      { status: 400 }
    );
  }

  await db.weeklyTest.update({
    where: { id: existing.id },
    data: { retakeAllowed: true },
  });

  return NextResponse.json({
    ok: true,
    message: `Retake allowed for Week ${week} test. The student can now retake it from their dashboard.`,
  });
}

/** DELETE /api/students/[id]/allow-retake?week=N — teacher/admin REVOKES a
 *  previously-granted retake permission. Sets `retakeAllowed = false`.
 *
 *  Use this when a teacher granted retake by mistake, or wants to take back
 *  the permission before the student has started the retake.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("allowing retakes"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // IDOR protection: verify the caller can access this student's data
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const week = Number(req.nextUrl.searchParams.get("week") ?? "0");

  // Look up the student's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(id);
  if (!week || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `Valid week (1-${totalWeeks}) required as ?week=N` }, { status: 400 });
  }

  const existing = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: id, week } },
  });

  if (!existing) {
    return NextResponse.json({ error: `No Week ${week} test found.` }, { status: 404 });
  }

  if (!existing.retakeAllowed) {
    return NextResponse.json({ error: `Retake is not currently allowed for Week ${week}.` }, { status: 400 });
  }

  await db.weeklyTest.update({
    where: { id: existing.id },
    data: { retakeAllowed: false },
  });

  return NextResponse.json({
    ok: true,
    message: `Retake revoked for Week ${week} test. The student can no longer retake it.`,
  });
}
