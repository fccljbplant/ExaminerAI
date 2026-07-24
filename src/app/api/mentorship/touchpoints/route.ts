import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/mentorship/touchpoints?userId=X — list touchpoints for a student.
 *
 *  Phase Three-Tab Redesign (Mentorship tab).
 *  Returns the full timeline of every contact between staff and student.
 *  Touchpoints are written automatically by alert-response actions AND
 *  manually by teachers via the Mentorship tab's "Log touchpoint" button.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEVELOPER,
  ]);
  if (!auth.ok) return auth.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const touchpoints = await db.mentorshipTouchpoint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Fetch actor names in a separate query (MentorshipTouchpoint has no
  // relation to the actor User — we resolve names here for narrative display)
  const actorIds = Array.from(new Set(touchpoints.map(t => t.actorUserId)));
  const actors = actorIds.length > 0
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorMap = new Map(actors.map(a => [a.id, a.name]));

  const formatted = touchpoints.map(t => ({
    id: t.id,
    actorUserId: t.actorUserId,
    actorName: actorMap.get(t.actorUserId),
    type: t.type,
    relatedAlertId: t.relatedAlertId,
    note: t.note,
    outcome: t.outcome,
    followUpDate: t.followUpDate ? t.followUpDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return NextResponse.json({ touchpoints: formatted });
}

/** POST /api/mentorship/touchpoints — log a new touchpoint.
 *
 *  Low-friction by design: just userId, type, note. Outcome + followUpDate optional.
 *  The whole point is that a teacher can log a 30-second check-in as easily
 *  as a major intervention — if logging is effortful, it won't happen.
 *
 *  Audit-logged so we know who logged what, when. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing mentorship touchpoints"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { userId, type, note, outcome, followUpDate, relatedAlertId } = body as {
    userId?: string; type?: string; note?: string; outcome?: string | null;
    followUpDate?: string | null; relatedAlertId?: string | null;
  };

  if (!userId || !type || !note?.trim()) {
    return NextResponse.json({ error: "userId, type, and note required" }, { status: 400 });
  }

  const VALID_TYPES = ["checkin", "alert_response", "escalation", "praise_note", "scheduled_followup"];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const touchpoint = await db.mentorshipTouchpoint.create({
      data: {
        userId,
        actorUserId: auth.ctx.payload.sub,
        type,
        note: note.trim(),
        outcome: outcome || null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        relatedAlertId: relatedAlertId || null,
      },
    });

    // Audit log — every touchpoint is recorded
    await logAudit({
      actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
      action: "mentorship_touchpoint_logged",
      target: { type: "user", id: userId },
      after: { type, note: note.trim().slice(0, 200), outcome: outcome || null, followUpDate: followUpDate || null },
      req,
    });

    return NextResponse.json({ touchpoint });
  } catch (err) {
    logger.error("Mentorship touchpoint creation failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to log touchpoint" }, { status: 500 });
  }
}
