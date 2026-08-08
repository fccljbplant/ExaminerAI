import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getUserOrg } from "@/lib/org";
import { logger } from "@/lib/logger";

export async function GET() {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const member = await getUserOrg(payload.sub);
  if (!member) return NextResponse.json({ error: "No org" }, { status: 404 });
  const members = await db.orgMember.findMany({
    where: { orgId: member.orgId, status: { not: "removed" } },
    include: { user: { select: { id: true, name: true, email: true, lastLogin: true } } },
    orderBy: { joined: "desc" },
  });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, role, seat } = body as { email?: string; role?: string; seat?: boolean };
  if (!email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });

  const orgMember = await getUserOrg(payload.sub);
  if (!orgMember) return NextResponse.json({ error: "No org" }, { status: 404 });

  const user = await db.user.findUnique({ where: { email: email.trim() } });
  if (!user) return NextResponse.json({ error: "User not found. Ask them to sign up first." }, { status: 404 });

  const existing = await db.orgMember.findFirst({ where: { orgId: orgMember.orgId, userId: user.id } });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const newMember = await db.orgMember.create({
    data: { orgId: orgMember.orgId, userId: user.id, role: role || "member", seat: seat ?? false, status: "active" },
  });
  return NextResponse.json({ member: newMember });
}
