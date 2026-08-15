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

/**
 * W16: platform overview stats + PM action items (V1 AdminOverview +
 * AdminPMTab restored).
 */
export async function getUserOverview() {
  const [totals, pending, blocked, activeToday, recentSignups, roleCounts, pendingResets] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "pending" } }),
      db.user.count({ where: { blocked: true } }),
      db.user.count({
        where: { lastLogin: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, email: true, role: true, createdAt: true, blocked: true },
      }),
      db.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),
      db.passwordResetRequest.count({ where: { status: "pending" } }),
    ]);

  const roleCount = Object.fromEntries(roleCounts.map((r) => [r.role, r._count._all]));
  const learnersWithoutProjects = await db.user.count({
    where: {
      role: "learner",
      learnProjects: { none: {} },
    },
  });

  return {
    stats: {
      total: totals,
      pending,
      blocked,
      activeToday,
      learners: roleCount.learner ?? 0,
      instructors: roleCount.instructor ?? 0,
      orgAdmins: roleCount.org_admin ?? 0,
      pendingResets,
      learnersWithoutProjects,
    },
    recentSignups: recentSignups.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      blocked: u.blocked,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

/** Course management read model — enrollment + test stats per course. */
export async function getCourseManagement() {
  const courses = await db.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      weeks: { select: { id: true } },
      enrollments: { select: { id: true, role: true } },
    },
  });
  return Promise.all(
    courses.map(async (c) => {
      const completedTests = await db.weeklyTest.count({
        where: { courseId: c.id, status: "completed" },
      });
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        domain: c.domain,
        level: c.level,
        isActive: c.isActive,
        published: c.published,
        featured: c.featured,
        weeks: c.weeks.length,
        learners: c.enrollments.filter((e) => e.role === "student").length,
        instructors: c.enrollments.filter((e) => e.role === "instructor").length,
        completedTests,
        createdAt: c.createdAt.toISOString(),
      };
    })
  );
}
