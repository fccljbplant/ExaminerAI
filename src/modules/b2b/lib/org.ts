import { db } from "@/lib/db";

export async function getUserOrg(userId: string) {
  const member = await db.orgMember.findFirst({
    where: { userId, status: "active" },
    include: { org: true },
  });
  return member;
}

export async function isOrgAdmin(userId: string): Promise<boolean> {
  const member = await getUserOrg(userId);
  return member?.role === "admin";
}

export async function getOrgMembers(orgId: string) {
  return db.orgMember.findMany({
    where: { orgId, status: { not: "removed" } },
    include: { user: { select: { id: true, name: true, email: true, currentWeek: true, lastLogin: true } } },
    orderBy: { joined: "desc" },
  });
}

export async function getOrgStats(orgId: string) {
  const [members, seats] = await Promise.all([
    db.orgMember.count({ where: { orgId, status: "active" } }),
    db.orgMember.count({ where: { orgId, seat: true, status: "active" } }),
  ]);
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { seats: true, name: true, plan: true } });
  return {
    memberCount: members,
    seatsUsed: seats,
    seatsTotal: org?.seats ?? 0,
    orgName: org?.name ?? "Unknown",
    plan: org?.plan ?? "free",
  };
}
