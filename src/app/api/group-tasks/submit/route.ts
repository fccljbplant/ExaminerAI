import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/group-tasks/submit — student submits their work for a group task.
 * Body: { groupTaskId, content, link? }
 * Creates or updates the submission (upsert via unique [groupTaskId, userId]).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can submit" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { groupTaskId, content, link } = body as {
    groupTaskId?: string; content?: string; link?: string;
  };

  if (!groupTaskId || !content?.trim()) {
    return NextResponse.json({ error: "groupTaskId and content required" }, { status: 400 });
  }

  // Verify the task exists and belongs to the student's batch
  const task = await db.groupTask.findUnique({
    where: { id: groupTaskId },
    select: { batchId: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.batchId !== user.batchId) {
    return NextResponse.json({ error: "Not in your batch" }, { status: 403 });
  }
  if (task.status === "closed") {
    return NextResponse.json({ error: "Task is closed" }, { status: 400 });
  }

  const submission = await db.groupTaskSubmission.upsert({
    where: { groupTaskId_userId: { groupTaskId, userId: user.id } },
    create: {
      groupTaskId,
      userId: user.id,
      content: content.trim(),
      link: link?.trim() || null,
    },
    update: {
      content: content.trim(),
      link: link?.trim() || null,
      submittedAt: new Date(),
      // Clear previous grading — the teacher needs to re-grade the new submission
      score: null,
      feedback: null,
      gradedAt: null,
    },
  });

  return NextResponse.json({ submission });
}

/**
 * GET /api/group-tasks/submit?groupTaskId=X — get all submissions for a task (teacher view).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupTaskId = req.nextUrl.searchParams.get("groupTaskId");
  if (!groupTaskId) return NextResponse.json({ error: "groupTaskId required" }, { status: 400 });

  // Students see only their own submission; staff see all
  const isStaff = ["teacher", "course_coordinator", "counselor", "principal", "administrator", "developer", "admin"].includes(user.role);

  const submissions = await db.groupTaskSubmission.findMany({
    where: { groupTaskId, ...(isStaff ? {} : { userId: user.id }) },
    include: isStaff ? { user: { select: { id: true, name: true, email: true } } } : undefined,
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ submissions });
}

/**
 * PATCH /api/group-tasks/submit — teacher grades a submission.
 * Body: { submissionId, score, feedback? }
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["teacher", "principal", "administrator", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { submissionId, score, feedback } = body as {
    submissionId?: string; score?: number; feedback?: string;
  };

  if (!submissionId || score === undefined) {
    return NextResponse.json({ error: "submissionId and score required" }, { status: 400 });
  }

  const submission = await db.groupTaskSubmission.update({
    where: { id: submissionId },
    data: {
      score: Math.max(0, Math.min(100, score)),
      feedback: feedback?.trim() || null,
      gradedAt: new Date(),
    },
  });

  return NextResponse.json({ submission });
}
