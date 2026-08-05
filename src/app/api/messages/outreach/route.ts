import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";

/** GET /api/messages/outreach — last-contacted timestamps for teacher's students.
 *
 *  Returns the most recent message sent to each student by the current
 *  teacher/staff member. Used to drive the "last contacted" presence
 *  indicator on the student roster.
 */
export async function GET() {
  const auth = await requireRole([
    UserRole.INSTRUCTOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const messages = await db.message.findMany({
    where: { fromId: auth.ctx.payload.sub },
    select: { toId: true, sentAt: true, subject: true },
    orderBy: { sentAt: "desc" },
  });

  // For each student, take the most recent message (messages are desc-ordered)
  const outreach: Record<string, { lastContactedAt: string; lastSubject: string | null }> = {};
  for (const msg of messages) {
    if (outreach[msg.toId]) continue;
    outreach[msg.toId] = { lastContactedAt: msg.sentAt.toISOString(), lastSubject: msg.subject };
  }

  return NextResponse.json({ outreach });
}
