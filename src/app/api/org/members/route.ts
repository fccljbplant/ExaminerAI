import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, UserRole } from "@/lib/rbac";

const InviteBody = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "mentor", "member"]).default("member"),
  seat: z.boolean().optional(),
}).strict();

async function getActorOrg(userId: string, isPlatformAdmin: boolean) {
  return db.orgMember.findFirst({
    where: {
      userId,
      status: "active",
      ...(isPlatformAdmin ? {} : { role: "admin" }),
    },
    include: { org: true },
  });
}

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isPlatformAdmin = hasRole(payload.role, [UserRole.PLATFORM_ADMIN]);
  if (!isPlatformAdmin && !hasRole(payload.role, [UserRole.ORG_ADMIN])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await getActorOrg(payload.sub, isPlatformAdmin);
  if (!member) return NextResponse.json({ error: "No active organization-admin membership" }, { status: 404 });
  const members = await db.orgMember.findMany({
    where: { orgId: member.orgId, status: { not: "removed" } },
    include: { user: { select: { id: true, name: true, email: true, lastLogin: true } } },
    orderBy: { joined: "desc" },
  });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isPlatformAdmin = hasRole(payload.role, [UserRole.PLATFORM_ADMIN]);
  if (!isPlatformAdmin && !hasRole(payload.role, [UserRole.ORG_ADMIN])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgMember = await getActorOrg(payload.sub, isPlatformAdmin);
  if (!orgMember) return NextResponse.json({ error: "No active organization-admin membership" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = InviteBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid member invitation" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ error: "User not found. Ask them to sign up first." }, { status: 404 });

  const existing = await db.orgMember.findFirst({ where: { orgId: orgMember.orgId, userId: user.id } });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const newMember = await db.orgMember.create({
    data: {
      orgId: orgMember.orgId,
      userId: user.id,
      role: parsed.data.role,
      seat: parsed.data.seat ?? false,
      status: "active",
    },
  });
  return NextResponse.json({ member: newMember });
}
