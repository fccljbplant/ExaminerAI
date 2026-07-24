import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/tasks?week=3 — list tasks for current user, optionally by week. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const week = req.nextUrl.searchParams.get("week");
  try {
    const tasks = await db.projectTask.findMany({
      where: { userId: user.id, ...(week ? { week: Number(week) } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    // Return 500 on real errors so the client can distinguish "no tasks" from "DB down"
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch tasks", tasks: [] },
      { status: 500 }
    );
  }
}

/** POST /api/tasks — create a task.
 *  Accepts: description, status?, week?, day?, dueDate?, estimatedMinutes?, isMilestone?, taskNotes?
 *  Validates week is 1-52 and day (if provided) is 1-5.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing tasks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    description, status, week, day, dueDate,
    estimatedMinutes, isMilestone, taskNotes,
  } = body as {
    description?: string;
    status?: string;
    week?: number;
    day?: number | null;
    dueDate?: string;
    estimatedMinutes?: number;
    isMilestone?: boolean;
    taskNotes?: string;
  };
  if (!description?.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  // Validate week (1-52)
  const weekNum = week ?? user.currentWeek;
  if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 52) {
    return NextResponse.json({ error: "week must be an integer 1-52" }, { status: 400 });
  }
  // Validate day (1-5 or null)
  let dayNum: number | null = null;
  if (day !== undefined && day !== null) {
    const d = Number(day);
    if (!Number.isInteger(d) || d < 1 || d > 5) {
      return NextResponse.json({ error: "day must be an integer 1-5 (or null)" }, { status: 400 });
    }
    dayNum = d;
  }

  try {
    const task = await db.projectTask.create({
      data: {
        userId: user.id,
        description: description.trim(),
        status: status ?? "planned",
        week: weekNum,
        day: dayNum,
        dueDate: dueDate ?? null,
        estimatedMinutes: estimatedMinutes ?? null,
        isMilestone: isMilestone ?? false,
        taskNotes: taskNotes?.trim() || null,
      },
    });
    return NextResponse.json({ task });
  } catch (err) {
    console.error("[POST /api/tasks] Create failed:", err);
    return NextResponse.json(
      { error: "Failed to create task. The database might be missing required columns. Please contact support.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** PATCH /api/tasks — update task.
 *  Body: { id, status?, description?, week?, day?, dueDate?, estimatedMinutes?, isMilestone?, taskNotes? }
 *  Validates week (1-52) and day (1-5 or null) when provided.
 */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing tasks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const {
    id, status, description, week, day, dueDate,
    estimatedMinutes, isMilestone, taskNotes,
  } = body as {
    id?: string;
    status?: string;
    description?: string;
    week?: number;
    day?: number | null;
    dueDate?: string | null;
    estimatedMinutes?: number | null;
    isMilestone?: boolean;
    taskNotes?: string | null;
  };
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Build update data only with provided fields
  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (description !== undefined) {
    if (description?.trim()) data.description = description.trim();
  }
  if (week !== undefined) {
    const w = Number(week);
    if (!Number.isInteger(w) || w < 1 || w > 52) {
      return NextResponse.json({ error: "week must be an integer 1-52" }, { status: 400 });
    }
    data.week = w;
  }
  if (day !== undefined) {
    if (day === null) {
      data.day = null;
    } else {
      const d = Number(day);
      if (!Number.isInteger(d) || d < 1 || d > 5) {
        return NextResponse.json({ error: "day must be an integer 1-5 (or null)" }, { status: 400 });
      }
      data.day = d;
    }
  }
  if (dueDate !== undefined) data.dueDate = dueDate || null;
  if (estimatedMinutes !== undefined) data.estimatedMinutes = estimatedMinutes || null;
  if (isMilestone !== undefined) data.isMilestone = !!isMilestone;
  if (taskNotes !== undefined) data.taskNotes = taskNotes?.trim() || null;

  try {
    const task = await db.projectTask.update({
      where: { id, userId: user.id },
      data,
    });
    return NextResponse.json({ task });
  } catch (err) {
    console.error("[PATCH /api/tasks] Update failed:", err);
    // Check if it's a "record not found" error vs a schema/column error
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("record not found") || errMsg.includes("P2025")) {
      return NextResponse.json({ error: "Task not found or not owned by user" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update task. Database schema might be out of sync.", details: errMsg },
      { status: 500 }
    );
  }
}

/** DELETE /api/tasks?id=... — delete a task + its comments (cascade). */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing tasks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Cascade: delete all comments referencing this task first
  try {
    await db.comment.deleteMany({ where: { taskId: id } });
  } catch {
    // non-fatal — comments might not exist
  }
  try {
    await db.projectTask.delete({ where: { id, userId: user.id } });
  } catch (err) {
    console.error("[DELETE /api/tasks] Delete failed:", err);
    return NextResponse.json({ error: "Task not found or not owned by user" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
