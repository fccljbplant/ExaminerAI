import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/journey — returns the student's completed manual step IDs. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { journeyProgress: true },
  });

  let steps: string[] = [];
  try { steps = JSON.parse(fullUser?.journeyProgress || "[]"); } catch { steps = []; }

  return NextResponse.json({ completedSteps: steps });
}

/** POST /api/journey — save a completed step ID to the DB.
 *  Body: { stepId: string } */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { stepId } = body as { stepId?: string };
  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 });

  // Read current progress
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { journeyProgress: true },
  });
  let steps: string[] = [];
  try { steps = JSON.parse(fullUser?.journeyProgress || "[]"); } catch { steps = []; }

  // Add the step if not already present
  if (!steps.includes(stepId)) {
    steps.push(stepId);
    await db.user.update({
      where: { id: user.id },
      data: { journeyProgress: JSON.stringify(steps) },
    });
  }

  return NextResponse.json({ ok: true, completedSteps: steps });
}

/** DELETE /api/journey — remove a step ID (for going back).
 *  Body: { stepId: string } */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let stepId: string | undefined;
  try {
    const body = await req.json();
    stepId = body?.stepId;
  } catch {
    // If no body, clear all
  }

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { journeyProgress: true },
  });
  let steps: string[] = [];
  try { steps = JSON.parse(fullUser?.journeyProgress || "[]"); } catch { steps = []; }

  if (stepId) {
    steps = steps.filter(s => s !== stepId);
  } else {
    steps = []; // clear all
  }

  await db.user.update({
    where: { id: user.id },
    data: { journeyProgress: JSON.stringify(steps) },
  });

  return NextResponse.json({ ok: true, completedSteps: steps });
}

/** PUT /api/journey — replace all completed steps (full reset or batch update).
 *  Body: { stepIds: string[] } */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { stepIds } = body as { stepIds?: string[] };
  if (!Array.isArray(stepIds)) return NextResponse.json({ error: "stepIds array required" }, { status: 400 });

  await db.user.update({
    where: { id: user.id },
    data: { journeyProgress: JSON.stringify(stepIds) },
  });

  return NextResponse.json({ ok: true, completedSteps: stepIds });
}
