import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** PATCH /api/messages/[id]/read — mark a message as read. */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const msg = await db.message.update({
    where: { id, toId: payload.sub },
    data: { isRead: true },
  });
  return NextResponse.json({ message: msg });
}
