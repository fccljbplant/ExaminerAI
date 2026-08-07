import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.role !== undefined) data.role = body.role;
  if (body.seat !== undefined) data.seat = body.seat;
  if (body.status !== undefined) data.status = body.status;

  const member = await db.orgMember.update({ where: { id: memberId }, data });
  return NextResponse.json({ member });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { memberId } = await params;
  await db.orgMember.update({ where: { id: memberId }, data: { status: "removed", seat: false } });
  return NextResponse.json({ ok: true });
}
