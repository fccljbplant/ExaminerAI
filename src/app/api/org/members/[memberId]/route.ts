import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, UserRole } from "@/lib/rbac";

const MemberPatch = z.object({
  role: z.enum(["admin", "mentor", "member"]).optional(),
  seat: z.boolean().optional(),
  status: z.enum(["active", "invited", "removed"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one member field is required",
});

async function getAdminOrgIds(userId: string): Promise<string[]> {
  const memberships = await db.orgMember.findMany({
    where: { userId, status: "active", role: "admin" },
    select: { orgId: true },
  });
  return memberships.map((membership) => membership.orgId);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isPlatformAdmin = hasRole(payload.role, [UserRole.PLATFORM_ADMIN]);
  if (!isPlatformAdmin && !hasRole(payload.role, [UserRole.ORG_ADMIN])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = MemberPatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid member update" }, { status: 400 });
  }

  const orgIds = isPlatformAdmin ? null : await getAdminOrgIds(payload.sub);
  if (orgIds && orgIds.length === 0) {
    return NextResponse.json({ error: "No active organization-admin scope" }, { status: 403 });
  }
  const member = await db.orgMember.findFirst({
    where: { id: memberId, ...(orgIds ? { orgId: { in: orgIds } } : {}) },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const updated = await db.orgMember.update({ where: { id: member.id }, data: parsed.data });
  return NextResponse.json({ member: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isPlatformAdmin = hasRole(payload.role, [UserRole.PLATFORM_ADMIN]);
  if (!isPlatformAdmin && !hasRole(payload.role, [UserRole.ORG_ADMIN])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const orgIds = isPlatformAdmin ? null : await getAdminOrgIds(payload.sub);
  if (orgIds && orgIds.length === 0) {
    return NextResponse.json({ error: "No active organization-admin scope" }, { status: 403 });
  }
  const member = await db.orgMember.findFirst({
    where: { id: memberId, ...(orgIds ? { orgId: { in: orgIds } } : {}) },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await db.orgMember.update({ where: { id: member.id }, data: { status: "removed", seat: false } });
  return NextResponse.json({ ok: true });
}
