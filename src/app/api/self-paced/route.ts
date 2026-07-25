import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSelfPacedStatus, advanceDay } from "@/modules/self-paced";
import { logAudit } from "@/lib/audit-log";

/**
 * GET /api/self-paced — returns the student's self-paced status.
 *
 * POST /api/self-paced — advances the student to the next day (or next week
 * if day 5 is done). Only allowed if today's tasks are all completed.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can use self-paced" }, { status: 403 });
  }

  const status = await getSelfPacedStatus(user.id);
  if (!status) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ status });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can use self-paced" }, { status: 403 });
  }

  const result = await advanceDay(user.id);
  if (!result) {
    const status = await getSelfPacedStatus(user.id);
    return NextResponse.json({
      error: "Cannot advance — complete today's tasks first.",
      status,
    }, { status: 403 });
  }

  // Audit log: student advanced day (self-paced)
  logAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: "self_paced_advance",
    target: { type: "user", id: user.id },
    after: { week: result.week, day: result.day },
    req,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    week: result.week,
    day: result.day,
    message: `Advanced to Week ${result.week}, Day ${result.day}`,
  });
}
