import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/messages/mark-all-read — mark all unread messages as read for the current user. */
export async function POST() {
  const _demoBlock = await demoWriteBlock("marking messages as read"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.message.updateMany({
    where: { toId: payload.sub, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ updated: result.count });
}
