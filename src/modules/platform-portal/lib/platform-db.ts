/**
 * modules/platform-portal/lib/platform-db.ts — W7 platform-portal DB wrapper
 *
 * The ONLY file in the platform subsystem that imports `db`. Aggregate
 * read model for the platform admin home: orgs (with seats/members),
 * platform totals, and the global audit feed.
 */

import { db } from "@/lib/db";

export async function getPlatformHome() {
  const [orgs, memberCount, userCount, auditCount, recentAudit] = await Promise.all([
    db.organization.findMany({
      include: { members: { select: { id: true, role: true, status: true, seat: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.orgMember.count({ where: { status: "active" } }),
    db.user.count(),
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        actorName: true,
        actorRole: true,
        action: true,
        targetType: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    kpis: {
      orgs: orgs.length,
      activeMembers: memberCount,
      users: userCount,
      auditActions: auditCount,
    },
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      seats: o.seats,
      seatsUsed: o.members.filter((m) => m.seat && m.status === "active").length,
      members: o.members.filter((m) => m.status === "active").length,
      createdAt: o.createdAt.toISOString(),
    })),
    recentAudit: recentAudit.map((r) => ({
      id: r.id,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      targetType: r.targetType,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
