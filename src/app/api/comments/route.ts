import { hasRole, ADMIN_ROLES, isStaffRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/comments?studentId=... — list instructor comments for a student.
 *  Staff can view comments for students they have access to.
 *  Students can only view their OWN comments. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  // RBAC + IDOR: students can only read their OWN comments; staff must have
  // batch access (assertCanAccessStudent handles this).
  if (payload.sub !== studentId) {
    try {
      await assertCanAccessStudent(payload, studentId);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }
  }

  const comments = await db.comment.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: { instructor: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ comments });
}

/** POST /api/comments — instructor/admin adds a comment on ANY student activity.
 *
 *  Body:
 *    - studentId (required)
 *    - body (required — the comment text)
 *    - interactionId (optional — comment on a practice question)
 *    - taskId (optional — comment on a project task)
 *    - weeklyTestId (optional — comment on a weekly test)
 *    - dailyLogId (optional — comment on a daily check-in)
 *    - marksOverride (optional — override the score on the entity)
 *
 *  If none of the optional IDs is provided, the comment is a general
 *  project comment shown at the top of the student's portfolio.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("posting comments"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { interactionId, taskId, weeklyTestId, dailyLogId, studentId, body: commentBody, marksOverride } = body as {
    interactionId?: string; taskId?: string; weeklyTestId?: string; dailyLogId?: string; studentId?: string; body?: string; marksOverride?: number;
  };
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }
  if (!commentBody || !String(commentBody).trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }
  // Input length validation
  if (String(commentBody).length > 10_000) {
    return NextResponse.json({ error: "Comment too long (max 10000 chars)" }, { status: 400 });
  }

  // Validate that the student exists
  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // IDOR protection: verify the caller can access this student
  try {
    await assertCanAccessStudent(payload, studentId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
  }

  const comment = await db.comment.create({
    data: {
      interactionId: interactionId || null,
      taskId: taskId || null,
      weeklyTestId: weeklyTestId || null,
      dailyLogId: dailyLogId || null,
      studentId,
      instructorId: payload.sub,
      body: String(commentBody).trim(),
      marksOverride: marksOverride ?? null,
    },
    include: { instructor: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ comment });
}

/** PATCH /api/comments?id=... — instructor/admin edits an existing comment.
 *
 *  Body:
 *    - body (optional — new comment text)
 *    - marksOverride (optional — new score override, null to clear)
 */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("posting comments"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.instructorId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Can only edit your own comments" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.body !== undefined) data.body = String(body.body).trim() || null;
  if (body.marksOverride !== undefined) {
    data.marksOverride = body.marksOverride === null || body.marksOverride === ""
      ? null
      : Number(body.marksOverride);
  }

  const updated = await db.comment.update({
    where: { id },
    data,
    include: { instructor: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ comment: updated });
}

/** DELETE /api/comments?id=... — instructor/admin deletes a comment. */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("posting comments"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.instructorId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
  }
  await db.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
