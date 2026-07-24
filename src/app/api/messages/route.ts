import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/messages — list messages for current user. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const box = req.nextUrl.searchParams.get("box") ?? "all"; // all | sent | received
  const where =
    box === "sent" ? { fromId: payload.sub } :
    box === "received" ? { toId: payload.sub } :
    { OR: [{ fromId: payload.sub }, { toId: payload.sub }] };
  const messages = await db.message.findMany({
    where,
    orderBy: { sentAt: "desc" },
    include: { from: { select: { name: true, email: true } }, to: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ messages });
}

/** POST /api/messages — send a message. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("sending messages"); if (_demoBlock) return _demoBlock;
  const { isFeatureEnabled } = await import("@/lib/feature-flags");
  if (!(await isFeatureEnabled("messages_enabled"))) return NextResponse.json({ error: "Messaging is currently disabled." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { toId, subject, body: text } = body as { toId?: string; subject?: string; body?: string };
  if (!toId || !text?.trim()) {
    return NextResponse.json({ error: "toId and body required" }, { status: 400 });
  }
  // Length caps — prevent abuse
  if (subject && subject.length > 200) {
    return NextResponse.json({ error: "Subject must be 200 characters or less" }, { status: 400 });
  }
  if (text.length > 10000) {
    return NextResponse.json({ error: "Message body must be 10,000 characters or less" }, { status: 400 });
  }
  // Verify recipient exists and isn't blocked
  const recipient = await db.user.findUnique({
    where: { id: toId },
    select: { id: true, blocked: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }
  if (recipient.blocked) {
    return NextResponse.json({ error: "Recipient account is blocked" }, { status: 400 });
  }
  const msg = await db.message.create({
    data: {
      fromId: user.id,
      toId,
      subject: subject ?? null,
      body: text.trim(),
    },
    include: { from: { select: { name: true, email: true } }, to: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ message: msg });
}
