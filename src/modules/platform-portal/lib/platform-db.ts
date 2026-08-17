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

  // SaaS P&L KPIs (2026-08-17) — platform Overview is revenue-first.
  const revenue = await getPlatformRevenue();

  return {
    kpis: {
      orgs: orgs.length,
      activeMembers: memberCount,
      users: userCount,
      auditActions: auditCount,
      mrr: revenue.mrr,
      pipelineMrr: revenue.pipelineMrr,
      fees30d: revenue.platformFees30d,
      payoutsPending: revenue.payoutsPending.sum,
      aiSpend30d: revenue.aiSpend30d,
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

// ── Tenants (SaaS control plane, 2026-08-17) ─────────────────────────

export const ORG_STATUSES = ["pending", "trial", "active", "suspended", "cancelled"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  seatsUsed: number;
  members: number;
  status: OrgStatus;
  trialEndsAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

async function toTenantRow(o: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  status: string;
  trialEndsAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
  members: { seat: boolean; status: string }[];
}): Promise<TenantRow> {
  const active = o.members.filter((m) => m.status === "active");
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    seats: o.seats,
    seatsUsed: active.filter((m) => m.seat).length,
    members: active.length,
    status: o.status as OrgStatus,
    trialEndsAt: o.trialEndsAt ? o.trialEndsAt.toISOString() : null,
    suspendedReason: o.suspendedReason,
    createdAt: o.createdAt.toISOString(),
  };
}

/** Tenant list with optional search (name/slug contains). */
export async function listTenants(search?: string): Promise<TenantRow[]> {
  const orgs = await db.organization.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { slug: { contains: search } },
          ],
        }
      : undefined,
    include: { members: { select: { id: true, seat: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(orgs.map(toTenantRow));
}

/** Tenant detail — lifecycle + subscription + invoice + flag overrides. */
export async function getTenantDetail(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      members: { select: { id: true, seat: true, status: true } },
      subscription: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!org) return null;

  const flagOverrides = await db.setting.findMany({
    where: {
      AND: [
        { key: { startsWith: "feature_portal_" } },
        { key: { endsWith: `_org:${orgId}` } },
      ],
    },
    select: { key: true, value: true },
  });

  return {
    ...(await toTenantRow(org)),
    description: org.description,
    website: org.website,
    subscription: org.subscription
      ? {
          id: org.subscription.id,
          stripeSubscriptionId: org.subscription.stripeSubscriptionId,
          plan: org.subscription.plan,
          seats: org.subscription.seats,
          status: org.subscription.status,
          currentPeriodEnd: org.subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    invoices: org.invoices.map((i) => ({
      id: i.id,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      periodEnd: i.periodEnd?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
    flagOverrides: flagOverrides.map((f) => ({
      key: f.key.replace(`_org:${orgId}`, ""),
      enabled: f.value === "true",
    })),
  };
}

export interface TenantUpdate {
  plan?: string;
  seats?: number;
  status?: OrgStatus;
  trialEndsAt?: string | null;
  suspendedReason?: string | null;
}

/** Update tenant lifecycle fields (platform admin only — enforced in the route). */
export async function updateTenant(
  orgId: string,
  patch: TenantUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { ok: false, error: "Organization not found" };

  const data: Record<string, unknown> = {};
  if (patch.plan !== undefined) data.plan = patch.plan;
  if (patch.seats !== undefined) {
    if (patch.seats < 1 || patch.seats > 100_000) {
      return { ok: false, error: "seats must be between 1 and 100000" };
    }
    data.seats = patch.seats;
  }
  if (patch.status !== undefined) {
    if (!ORG_STATUSES.includes(patch.status)) {
      return { ok: false, error: `status must be one of ${ORG_STATUSES.join(", ")}` };
    }
    data.status = patch.status;
  }
  if (patch.trialEndsAt !== undefined) {
    data.trialEndsAt = patch.trialEndsAt ? new Date(patch.trialEndsAt) : null;
  }
  if (patch.suspendedReason !== undefined) {
    data.suspendedReason = patch.suspendedReason ?? null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }

  await db.organization.update({ where: { id: orgId }, data });
  return { ok: true };
}

/** Per-org portal flag overrides — GET/PUT backing the rollout matrix. */
export async function getOrgFlagOverrides(orgId: string): Promise<{ key: string; enabled: boolean }[]> {
  const rows = await db.setting.findMany({
    where: { key: { endsWith: `_org:${orgId}` } },
    select: { key: true, value: true },
  });
  return rows.map((r) => ({
    key: r.key.replace(`_org:${orgId}`, ""),
    enabled: r.value === "true",
  }));
}

export async function setOrgFlagOverride(
  orgId: string,
  key: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { ok: false, error: "Organization not found" };
  if (!/^feature_portal_[a-z_]+_v2$/.test(key)) {
    return { ok: false, error: "Invalid portal flag key" };
  }
  await db.setting.upsert({
    where: { key: `${key}_org:${orgId}` },
    update: { value: String(enabled) },
    create: { key: `${key}_org:${orgId}`, value: String(enabled) },
  });
  return { ok: true };
}

// ── Platform revenue & payouts (SaaS P&L, 2026-08-17) ────────────────

const SEAT_PRICE_USD = 29;

/** Platform revenue rollup: MRR from active subscriptions, B2C fees,
 *  pending creator payouts, trial health and AI spend. */
export async function getPlatformRevenue() {
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 86_400_000);
  const since7d = new Date(now.getTime() - 7 * 86_400_000);

  const [
    subscriptions,
    fees30d,
    payoutsPending,
    trialsEnding,
    aiSpend30d,
    payments30d,
    refunded30d,
  ] = await Promise.all([
    db.subscription.findMany({
      where: { status: { in: ["active", "trialing"] } },
      select: { plan: true, seats: true, status: true },
    }),
    db.payment.aggregate({
      where: { status: "completed", createdAt: { gte: since30d } },
      _sum: { platformFee: true, amount: true },
    }),
    db.payout.findMany({
      where: { status: "pending" },
      select: { id: true, instructorId: true, amount: true, scheduledFor: true },
    }),
    db.organization.findMany({
      where: { status: "trial", trialEndsAt: { lte: new Date(now.getTime() + 7 * 86_400_000), gte: now } },
      select: { id: true, name: true, trialEndsAt: true },
      orderBy: { trialEndsAt: "asc" },
    }),
    db.aIUsageLog.aggregate({
      where: { createdAt: { gte: since30d }, costUsd: { not: null } },
      _sum: { costUsd: true },
    }),
    db.payment.count({ where: { createdAt: { gte: since30d } } }),
    db.payment.count({ where: { status: "refunded", refundedAt: { gte: since30d } } }),
  ]);

  // MRR: active subscriptions at $29/seat/month (trialing counts as
  // pipeline, shown separately).
  const active = subscriptions.filter((s) => s.status === "active");
  const mrr = active.reduce((sum, s) => sum + s.seats * SEAT_PRICE_USD, 0);
  const pipelineMrr = subscriptions
    .filter((s) => s.status === "trialing")
    .reduce((sum, s) => sum + s.seats * SEAT_PRICE_USD, 0);

  return {
    mrr,
    pipelineMrr,
    b2cGross30d: Math.round((fees30d._sum.amount ?? 0) * 100) / 100,
    platformFees30d: Math.round((fees30d._sum.platformFee ?? 0) * 100) / 100,
    payments30d,
    refunded30d,
    payoutsPending: {
      count: payoutsPending.length,
      sum: Math.round(payoutsPending.reduce((s, p) => s + p.amount, 0) * 100) / 100,
    },
    aiSpend30d: Math.round((aiSpend30d._sum.costUsd ?? 0) * 100) / 100,
    trialsEnding7d: trialsEnding.map((t) => ({
      id: t.id,
      name: t.name,
      trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
    })),
    subscriptionStates: subscriptions.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

/** Payout queue for platform oversight + a manual sweep trigger. */
export async function listPayoutQueue() {
  const [pending, recent] = await Promise.all([
    db.payout.findMany({
      where: { status: "pending" },
      include: { instructor: { select: { email: true, name: true, stripeAccountId: true } } },
      orderBy: { scheduledFor: "asc" },
      take: 100,
    }),
    db.payout.findMany({
      where: { status: { in: ["paid", "failed"] } },
      include: { instructor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const toView = (p: typeof pending[number] | typeof recent[number]) => ({
    id: p.id,
    instructorEmail: p.instructor.email,
    instructorName: p.instructor.name,
    amount: p.amount,
    status: p.status,
    stripeTransferId: p.stripeTransferId,
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  });
  return { pending: pending.map(toView), recent: recent.map(toView) };
}

/** Recent B2C payments for the revenue screen's refund actions. */
export async function listRecentPayments() {
  const payments = await db.payment.findMany({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { course: { select: { name: true } }, user: { select: { email: true } } },
  });
  return payments.map((p) => ({
    id: p.id,
    courseName: p.course.name,
    buyerEmail: p.user.email,
    amount: p.amount,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    refundable: Boolean(p.stripePaymentIntentId) || !process.env.STRIPE_SECRET_KEY,
  }));
}
