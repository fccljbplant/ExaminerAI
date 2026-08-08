import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getCourseDurationWeeks } from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** PATCH /api/students/[id]/edit-weekly-test — instructor/admin edits the
 *  AI-generated results of a completed weekly test.
 *
 *  Body:
 *    - week: number (1..courseDuration, required — identifies which weekly test to edit)
 *    - score?: number (0-100)
 *
 *  Only fields that are present in the body are updated. The teacher can
 *  use this to correct an unfair AI score (e.g. raise a 35% to a 50%).
 *
 *  The original AI values are NOT preserved — this overwrites them.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("editing weekly tests"); if (_demoBlock) return _demoBlock;
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
  const { week, score } = body as {
    week?: number; score?: number;
  };

  // Look up the student's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(id);
  if (!week || week < 1 || week > totalWeeks) {
    return NextResponse.json({ error: `Valid week (1-${totalWeeks}) required` }, { status: 400 });
  }

  const existing = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: id, week } },
  });

  if (!existing) {
    return NextResponse.json({ error: `Week ${week} test not found for this student.` }, { status: 404 });
  }

  if (existing.status !== "completed") {
    return NextResponse.json(
      { error: `Cannot edit a test that isn't completed (current status: ${existing.status}).` },
      { status: 400 }
    );
  }

  // Build update data only with provided fields
  const data: Record<string, unknown> = {};
  if (score !== undefined) {
    const s = Number(score);
    if (Number.isNaN(s) || s < 0 || s > 100) {
      return NextResponse.json({ error: "Score must be 0-100" }, { status: 400 });
    }
    data.score = s;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update — provide score." }, { status: 400 });
  }

  const updated = await db.weeklyTest.update({
    where: { id: existing.id },
    data,
    select: { id: true, week: true, score: true, status: true },
  });

  return NextResponse.json({
    ok: true,
    message: `Week ${week} test results updated.`,
    test: updated,
  });
}
