import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getStaffAuthorizedStudentCourseIds } from "@/modules/instructor-portal/authorized-student-courses";
import { logAudit, AuditAction } from "@/lib/audit-log";

type CommentActivityRefs = {
  interactionId?: string | null;
  taskId?: string | null;
  weeklyTestId?: string | null;
  dailyLogId?: string | null;
};

/** A staff comment must be attached only to records belonging to this learner
 * and the explicitly selected, currently authorised course. General and
 * mixed-course legacy comments are read-only and cannot be newly written. */
async function commentLinksMatchCourse(
  studentId: string,
  courseId: string,
  refs: CommentActivityRefs,
): Promise<boolean> {
  const ids = [refs.interactionId, refs.taskId, refs.weeklyTestId, refs.dailyLogId]
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return false;

  const checks: Array<Promise<{ id: string } | null>> = [];
  if (refs.interactionId) {
    checks.push(db.interaction.findFirst({
      where: { id: refs.interactionId, userId: studentId, courseId },
      select: { id: true },
    }));
  }
  if (refs.taskId) {
    checks.push(db.projectTask.findFirst({
      where: { id: refs.taskId, userId: studentId, courseId },
      select: { id: true },
    }));
  }
  if (refs.weeklyTestId) {
    checks.push(db.weeklyTest.findFirst({
      where: { id: refs.weeklyTestId, userId: studentId, courseId },
      select: { id: true },
    }));
  }
  if (refs.dailyLogId) {
    checks.push(db.dailyLog.findFirst({
      where: { id: refs.dailyLogId, userId: studentId, courseId },
      select: { id: true },
    }));
  }

  const records = await Promise.all(checks);
  return records.length === ids.length && records.every(Boolean);
}

async function staffCanAccessCourse(
  payload: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>,
  studentId: string,
  courseId: string,
): Promise<boolean> {
  await assertCanAccessStudent(payload, studentId);
  const authorisedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, studentId);
  return authorisedCourseIds.includes(courseId);
}

/** GET /api/comments?studentId=...&courseId=... — list comments.
 *  Staff must select an authorised course; only comments whose every linked
 *  activity record belongs to that course are returned. Learners can view
 *  their own full history or filter it to one enrolled course. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const isSelf = payload.sub === studentId;
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!isSelf) {
    try {
      await assertCanAccessStudent(payload, studentId);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required for staff comment views" }, { status: 400 });
    }
    const authorizedCourseIds = await getStaffAuthorizedStudentCourseIds(payload, studentId);
    if (!authorizedCourseIds.includes(courseId)) {
      return NextResponse.json({ error: "You cannot access comments for this course" }, { status: 403 });
    }
  } else if (courseId) {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: studentId, role: "student", courseId },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
    }
  }

  if (isSelf && !courseId) {
    const comments = await db.comment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { instructor: { select: { name: true, email: true } } },
    });
    return NextResponse.json({ comments });
  }

  // Comments have no courseId column. Resolve the selected course's linked
  // record IDs, then reject mixed-course and unassigned legacy comments.
  const [interactions, tasks, weeklyTests, dailyLogs] = await Promise.all([
    db.interaction.findMany({ where: { userId: studentId, courseId }, select: { id: true } }),
    db.projectTask.findMany({ where: { userId: studentId, courseId }, select: { id: true } }),
    db.weeklyTest.findMany({ where: { userId: studentId, courseId }, select: { id: true } }),
    db.dailyLog.findMany({ where: { userId: studentId, courseId }, select: { id: true } }),
  ]);

  const allowed = {
    interactionId: new Set(interactions.map((record) => record.id)),
    taskId: new Set(tasks.map((record) => record.id)),
    weeklyTestId: new Set(weeklyTests.map((record) => record.id)),
    dailyLogId: new Set(dailyLogs.map((record) => record.id)),
  };
  const relationFilters = [
    ...(allowed.interactionId.size ? [{ interactionId: { in: [...allowed.interactionId] } }] : []),
    ...(allowed.taskId.size ? [{ taskId: { in: [...allowed.taskId] } }] : []),
    ...(allowed.weeklyTestId.size ? [{ weeklyTestId: { in: [...allowed.weeklyTestId] } }] : []),
    ...(allowed.dailyLogId.size ? [{ dailyLogId: { in: [...allowed.dailyLogId] } }] : []),
  ];

  if (relationFilters.length === 0) return NextResponse.json({ comments: [] });

  const candidates = await db.comment.findMany({
    where: { studentId, OR: relationFilters },
    orderBy: { createdAt: "desc" },
    include: { instructor: { select: { name: true, email: true } } },
  });
  const comments = candidates.filter((comment) => {
    const references = [
      ["interactionId", comment.interactionId],
      ["taskId", comment.taskId],
      ["weeklyTestId", comment.weeklyTestId],
      ["dailyLogId", comment.dailyLogId],
    ] as const;
    const linked = references.filter(([, id]) => id !== null);
    return linked.length > 0 && linked.every(([field, id]) => id !== null && allowed[field].has(id));
  });

  return NextResponse.json({ comments });
}

/** POST /api/comments — instructor/admin adds feedback to selected-course activity.
 *
 *  Body:
 *    - studentId (required)
 *    - courseId (required; server-validated against the caller's current course scope)
 *    - body (required — the comment text)
 *    - at least one of interactionId, taskId, weeklyTestId or dailyLogId (required)
 *    - marksOverride (optional — override the score on the linked entity)
 *
 *  Every supplied activity ID must belong to the target learner and selected
 *  course. General/unassigned comments are not writable through this endpoint.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("posting comments"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { interactionId, taskId, weeklyTestId, dailyLogId, studentId, courseId, body: commentBody, marksOverride } = body as {
    interactionId?: string; taskId?: string; weeklyTestId?: string; dailyLogId?: string;
    studentId?: string; courseId?: string; body?: string; marksOverride?: number;
  };
  if (typeof studentId !== "string" || !studentId.trim()) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }
  if (typeof courseId !== "string" || !courseId.trim()) {
    return NextResponse.json({ error: "courseId is required for course-linked comments" }, { status: 400 });
  }
  const providedRefs = [interactionId, taskId, weeklyTestId, dailyLogId]
    .filter((id) => id !== undefined && id !== null);
  if (providedRefs.some((id) => typeof id !== "string" || !id.trim())) {
    return NextResponse.json({ error: "Activity IDs must be non-empty strings" }, { status: 400 });
  }
  if (![interactionId, taskId, weeklyTestId, dailyLogId].some((id) => typeof id === "string" && id.length > 0)) {
    return NextResponse.json({ error: "A comment must be linked to a course activity" }, { status: 400 });
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

  // IDOR + course scope: client-supplied courseId never grants access.
  try {
    if (!(await staffCanAccessCourse(payload, studentId, courseId))) {
      return NextResponse.json({ error: "You cannot comment on this learner's selected course" }, { status: 403 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }
  const refs = { interactionId, taskId, weeklyTestId, dailyLogId };
  if (!(await commentLinksMatchCourse(studentId, courseId, refs))) {
    return NextResponse.json({ error: "Every linked activity must belong to the learner and selected course" }, { status: 403 });
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

  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.COMMENT_CREATED,
    target: { type: "comment", id: comment.id },
    metadata: {
      studentId,
      courseId,
      activityIds: [interactionId, taskId, weeklyTestId, dailyLogId].filter(Boolean),
    },
    req,
  });

  return NextResponse.json({ comment });
}

/** PATCH /api/comments?id=...&courseId=... — instructor/admin edits a linked comment after course revalidation.
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
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.instructorId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Can only edit your own comments" }, { status: 403 });
  }
  try {
    if (!(await staffCanAccessCourse(payload, existing.studentId, courseId))) {
      return NextResponse.json({ error: "You cannot edit comments for this course" }, { status: 403 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }
  if (!(await commentLinksMatchCourse(existing.studentId, courseId, existing))) {
    return NextResponse.json({ error: "This comment is not wholly linked to the selected course" }, { status: 403 });
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
  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.COMMENT_UPDATED,
    target: { type: "comment", id },
    metadata: {
      studentId: existing.studentId,
      courseId,
      updatedFields: Object.keys(data),
    },
    req,
  });
  return NextResponse.json({ comment: updated });
}

/** DELETE /api/comments?id=...&courseId=... — delete a linked comment after course revalidation. */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("posting comments"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.instructorId !== payload.sub && !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
  }
  try {
    if (!(await staffCanAccessCourse(payload, comment.studentId, courseId))) {
      return NextResponse.json({ error: "You cannot delete comments for this course" }, { status: 403 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Access denied" }, { status: 403 });
  }
  if (!(await commentLinksMatchCourse(comment.studentId, courseId, comment))) {
    return NextResponse.json({ error: "This comment is not wholly linked to the selected course" }, { status: 403 });
  }
  await db.comment.delete({ where: { id } });
  await logAudit({
    actor: { id: payload.sub, name: payload.name || payload.sub, role: payload.role },
    action: AuditAction.COMMENT_DELETED,
    target: { type: "comment", id },
    metadata: {
      studentId: comment.studentId,
      courseId,
      activityIds: [comment.interactionId, comment.taskId, comment.weeklyTestId, comment.dailyLogId].filter(Boolean),
    },
    req,
  });
  return NextResponse.json({ ok: true });
}
