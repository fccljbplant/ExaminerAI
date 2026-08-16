import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/project/weeks — list all project weeks for the current user.
 *  Returns the custom week titles + summaries. If no ProjectWeek rows exist
 *  yet, returns an empty array (the UI falls back to curriculum phase names). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weeks = await db.projectWeek.findMany({
    where: { userId: user.id },
    orderBy: { weekNumber: "asc" },
  });

  return NextResponse.json({ weeks });
}

/** POST /api/project/weeks — create or update a project week.
 *  Body: { weekNumber, title, summary?, milestones? }
 *  Uses upsert so the student can edit an existing week or create a new one. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing project weeks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { weekNumber, title, summary, milestones } = body as {
    weekNumber?: number;
    title?: string;
    summary?: string;
    milestones?: string[];
  };

  if (weekNumber === undefined || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 52) {
    return NextResponse.json({ error: "weekNumber must be 1-52" }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const weekNum = weekNumber as number;
  const milestonesJson = Array.isArray(milestones) ? JSON.stringify(milestones) : "[]";

  // Unique key is now (userId, projectId, weekNumber) — legacy rows live
  // at projectId = null, so use find/create/update instead of upsert.
  const existing = await db.projectWeek.findFirst({
    where: { userId: user.id, projectId: null, weekNumber: weekNum },
  });
  let week;
  if (existing) {
    week = await db.projectWeek.update({
      where: { id: existing.id },
      data: {
        title: title.trim(),
        ...(summary !== undefined ? { summary: summary.trim() } : {}),
        ...(milestones !== undefined ? { milestones: milestonesJson } : {}),
      },
    });
  } else {
    week = await db.projectWeek.create({
      data: {
        userId: user.id,
        projectId: null,
        weekNumber: weekNum,
        title: title.trim(),
        summary: summary?.trim() || "",
        milestones: milestonesJson,
      },
    });
  }

  return NextResponse.json({ week });
}

/** PATCH /api/project/weeks — update a specific week by id.
 *  Body: { id, title?, summary?, milestones? } */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing project weeks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, title, summary, milestones } = body as {
    id?: string;
    title?: string;
    summary?: string;
    milestones?: string[];
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (summary !== undefined) data.summary = summary.trim();
  if (milestones !== undefined) data.milestones = JSON.stringify(milestones);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, message: "No changes." });
  }

  try {
    const week = await db.projectWeek.update({
      where: { id, userId: user.id },
      data,
    });
    return NextResponse.json({ week });
  } catch {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
}

/** DELETE /api/project/weeks?id=... — delete a project week. */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing project weeks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db.projectWeek.delete({ where: { id, userId: user.id } });
  } catch {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
