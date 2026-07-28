import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";

/** GET /api/messages/outreach — last-contacted timestamps for teacher's students.
 *
 *  P1.2 FIX: Previously only counted Messages. Now also includes
 *  MentorshipTouchpoints — so logging a touchpoint ("called student's
 *  parent") updates the presence indicator even without sending a
 *  message. This is the data-flow fix the audit flagged.
 */
export async function GET() {
  const auth = await requireRole([
    UserRole.INSTRUCTOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  // Fetch both messages AND touchpoints in parallel
  const [messages, touchpoints] = await Promise.all([
    db.message.findMany({
      where: { fromId: auth.ctx.payload.sub },
      select: { toId: true, sentAt: true, subject: true },
      orderBy: { sentAt: "desc" },
    }),
    db.mentorshipTouchpoint.findMany({
      where: { actorUserId: auth.ctx.payload.sub },
      select: { userId: true, createdAt: true, note: true, type: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Merge: for each student, take the most recent contact from either source
  const outreach: Record<string, { lastContactedAt: string; lastSubject: string | null }> = {};

  // Process messages (subject → lastSubject)
  for (const msg of messages) {
    if (outreach[msg.toId]) continue; // already have a more recent one (messages are desc-ordered)
    outreach[msg.toId] = { lastContactedAt: msg.sentAt.toISOString(), lastSubject: msg.subject };
  }

  // Process touchpoints — update if more recent than the message-based entry
  for (const tp of touchpoints) {
    const tpDate = tp.createdAt.toISOString();
    const existing = outreach[tp.userId];
    if (!existing || new Date(tpDate) > new Date(existing.lastContactedAt)) {
      // Use the touchpoint note (truncated) as the "subject"
      const notePreview = tp.note.length > 60 ? tp.note.slice(0, 60) + "…" : tp.note;
      outreach[tp.userId] = {
        lastContactedAt: tpDate,
        lastSubject: `[${tp.type}] ${notePreview}`,
      };
    }
  }

  return NextResponse.json({ outreach });
}
