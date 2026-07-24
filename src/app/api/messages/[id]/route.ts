import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** DELETE /api/messages/[id] — delete a message.
 *
 *  Authorization rules:
 *  - Teachers and admins can delete ANY message (sent or received).
 *  - Students can only delete messages THEY sent or received.
 *
 *  This is primarily used by teachers to moderate conversations and remove
 *  inappropriate or accidental messages.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("sending messages"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const msg = await db.message.findUnique({ where: { id } });
  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // H7-security: Only admins can delete ANY message. Teachers/TAs and
  // students can only delete messages they sent or received — not other
  // people's private conversations.
  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  const isOwnMessage = msg.fromId === payload.sub || msg.toId === payload.sub;

  if (!isAdmin && !isOwnMessage) {
    return NextResponse.json({ error: "Forbidden — you can only delete your own messages" }, { status: 403 });
  }

  await db.message.delete({ where: { id } });

  return NextResponse.json({ ok: true, message: "Message deleted" });
}
