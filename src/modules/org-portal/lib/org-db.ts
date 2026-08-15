/**
 * modules/org-portal/lib/org-db.ts — W7 org-portal DB wrapper
 *
 * The ONLY file in the org subsystem that imports `db`. All org v2
 * routes go through here: member management (invite/deactivate with
 * audit rows), org settings (portal flags + branding in Setting rows,
 * following the org-theme:<orgId> convention from migrate-org-themes),
 * and the audit feed scoped to the org's own members.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import type { AuditActor } from "@/lib/audit-log";
import { DEFAULT_BRAND_OKLCH, oklchToHex } from "@/modules/theme";

/** Platform default brand — token-defined, never a literal hex (audit law). */
const DEFAULT_BRAND_HEX = oklchToHex(DEFAULT_BRAND_OKLCH);

export class OrgError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OrgError";
  }
}

// ── Context ─────────────────────────────────────────────────────────────

export async function getOrgContext(userId: string) {
  const member = await db.orgMember.findFirst({
    where: { userId, status: "active" },
    include: { org: true },
  });
  return member ?? null;
}

// ── Members (O2) ────────────────────────────────────────────────────────

export async function listMembers(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new OrgError("Organization not found", "NOT_FOUND", 404);
  const members = await db.orgMember.findMany({
    where: { orgId, status: { not: "removed" } },
    include: { user: { select: { id: true, name: true, email: true, lastLogin: true } } },
    orderBy: { joined: "desc" },
  });
  const seatsUsed = members.filter((m) => m.seat).length;
  return { org, members, seatsUsed };
}

export async function inviteMember(
  orgId: string,
  actor: AuditActor,
  input: { email: string; role?: string; seat?: boolean },
) {
  const email = input.email.trim();
  if (!email) throw new OrgError("Email is required", "VALIDATION", 400);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new OrgError("No account with that email — ask them to sign up first", "NOT_FOUND", 404);
  }
  const existing = await db.orgMember.findFirst({ where: { orgId, userId: user.id } });
  if (existing) throw new OrgError("Already a member", "CONFLICT", 409);

  const member = await db.orgMember.create({
    data: {
      orgId,
      userId: user.id,
      role: input.role === "admin" ? "admin" : input.role === "mentor" ? "mentor" : "member",
      seat: input.seat ?? false,
      status: "active",
    },
    include: { user: { select: { id: true, name: true, email: true, lastLogin: true } } },
  });

  await logAudit({
    actor,
    action: "org_member_added",
    target: { type: "user", id: user.id },
    after: { email: user.email, role: member.role, seat: member.seat },
  });

  return member;
}

/** Count mentors (role=mentor) — W11 audit: V1 mentor KPI. */
export async function countMentors(orgId: string) {
  return db.orgMember.count({ where: { orgId, role: "mentor", status: "active" } });
}

/** Count members still in the invited state — W11 audit: V1 pending-invites KPI. */
export async function countPendingInvites(orgId: string) {
  return db.orgMember.count({ where: { orgId, status: "invited" } });
}

/** Toggle a member's seat flag (V1 per-member seat control). Audited. */
export async function setMemberSeat(
  orgId: string,
  memberId: string,
  actor: AuditActor,
  seat: boolean,
) {
  const member = await db.orgMember.findFirst({ where: { id: memberId, orgId } });
  if (!member) throw new OrgError("Member not found", "NOT_FOUND", 404);
  if (member.seat === seat) return member;
  const updated = await db.orgMember.update({ where: { id: member.id }, data: { seat } });
  await logAudit({
    actor,
    action: "org_member_seat",
    target: { type: "user", id: member.userId },
    before: { seat: member.seat },
    after: { seat },
  });
  return updated;
}

/** Deactivate (removed) or restore (active). Every change is audited. */
export async function setMemberStatus(
  orgId: string,
  memberId: string,
  actor: AuditActor,
  status: "active" | "removed",
) {
  const member = await db.orgMember.findFirst({ where: { id: memberId, orgId } });
  if (!member) throw new OrgError("Member not found", "NOT_FOUND", 404);
  if (member.status === status) return member;

  const updated = await db.orgMember.update({
    where: { id: memberId },
    data: { status },
  });

  await logAudit({
    actor,
    action: status === "removed" ? "org_member_removed" : "org_member_restored",
    target: { type: "user", id: member.userId },
    before: { status: member.status },
    after: { status },
  });

  return updated;
}

// ── Settings (O4) ───────────────────────────────────────────────────────

export const ORG_SETTING_PREFIX = "org-theme:";

export interface BrandingInput {
  brandHex?: string;
  mode?: "light" | "dark" | "bed";
}

export async function getOrgSettings(orgId: string) {
  const rows = await db.setting.findMany({
    where: { key: { startsWith: `${ORG_SETTING_PREFIX}${orgId}` } },
  });
  const themeRow = rows.find((r) => r.key === `${ORG_SETTING_PREFIX}${orgId}`);
  let branding: { brandHex: string; mode: string; derivedAt: string } | null = null;
  if (themeRow?.value) {
    try {
      branding = JSON.parse(themeRow.value);
    } catch {
      branding = null;
    }
  }
  return { branding };
}

/** Persist branding (Setting `org-theme:<orgId>` — migrate-org-themes
 *  convention, idempotent). Audited.
 *
 *  Portal rollout flags are intentionally not writable here (audit
 *  9.2): they are global platform-level rows. */
export async function updateOrgSettings(
  orgId: string,
  actor: AuditActor,
  input: { branding?: BrandingInput },
) {
  const changes: string[] = [];

  if (input.branding) {
    const existing = await getOrgSettings(orgId);
    const value = JSON.stringify({
      orgId,
      mode: input.branding.mode ?? existing.branding?.mode ?? "light",
      brandHex: input.branding.brandHex ?? existing.branding?.brandHex ?? DEFAULT_BRAND_HEX,
      derivedAt: new Date().toISOString(),
    });
    await db.setting.upsert({
      where: { key: `${ORG_SETTING_PREFIX}${orgId}` },
      update: { value },
      create: { key: `${ORG_SETTING_PREFIX}${orgId}`, value },
    });
    changes.push("branding");
  }

  if (changes.length > 0) {
    await logAudit({
      actor,
      action: "org_settings_updated",
      target: { type: "org", id: orgId },
      after: { changes },
    });
  }

  return { changes };
}

// ── Audit feed (O5) ─────────────────────────────────────────────────────

export async function listOrgAudit(
  orgId: string,
  query: { action?: string; cursor?: string; limit?: number },
) {
  // Audit rows are not org-scoped in the schema — scope by the org's
  // member user ids (the actors who can act on this org).
  const memberIds = await db.orgMember.findMany({
    where: { orgId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);
  if (userIds.length === 0) return { items: [], nextCursor: null };

  const limit = query.limit ?? 20;
  const rows = await db.auditLog.findMany({
    where: {
      actorUserId: { in: userIds },
      ...(query.action ? { action: query.action } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: limit,
    select: {
      id: true,
      actorName: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
    },
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return {
    items: rows.map((r) => ({
      id: r.id,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

// ── Registries (O3) ─────────────────────────────────────────────────────

export const REGISTRY_KINDS = ["submission_type", "rubric_template", "category"] as const;
export type RegistryKind = (typeof REGISTRY_KINDS)[number];

export interface RegistryView {
  id: string;
  kind: string;
  key: string;
  label: string;
  config: unknown;
  sortOrder: number;
  isActive: boolean;
  /** false = platform default row (orgId null); true = org override. */
  isOrgOverride: boolean;
}

/** Defaults (orgId null) + org overrides merged by key — the org row
 *  shadows the platform default (RegistryRow semantics). */
export async function listRegistries(orgId: string, kind: RegistryKind): Promise<RegistryView[]> {
  const rows = await db.registryRow.findMany({
    where: { kind, OR: [{ orgId: null }, { orgId }] },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const byKey = new Map<string, RegistryView>();
  for (const r of rows) {
    byKey.set(r.key, {
      id: r.id,
      kind: r.kind,
      key: r.key,
      label: r.label,
      config: r.configJson ?? {},
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      isOrgOverride: r.orgId === orgId,
    });
  }
  return [...byKey.values()];
}

/** Create (or update) an org-scoped override for a registry key. The org
 *  row shadows the platform default. Audited. */
export async function upsertRegistry(
  orgId: string,
  actor: AuditActor,
  input: { kind: RegistryKind; key: string; label: string; config?: unknown },
) {
  const key = input.key.trim();
  if (!key) throw new OrgError("Key is required", "VALIDATION", 400);
  if (!REGISTRY_KINDS.includes(input.kind)) {
    throw new OrgError("Unknown registry kind", "VALIDATION", 400);
  }

  const row = await db.registryRow.upsert({
    where: { orgId_kind_key: { orgId, kind: input.kind, key } },
    update: { label: input.label, configJson: (input.config ?? {}) as Prisma.InputJsonValue, isActive: true },
    create: {
      orgId,
      kind: input.kind,
      key,
      label: input.label,
      configJson: (input.config ?? {}) as Prisma.InputJsonValue,
      sortOrder: Date.now() % 1000,
    },
  });

  await logAudit({
    actor,
    action: "org_registry_updated",
    target: { type: "registry_row", id: row.id },
    after: { kind: input.kind, key, label: input.label },
  });

  return row;
}

/** Enable/disable an org-scoped registry row (defaults are read-only). */
export async function setRegistryActive(
  orgId: string,
  rowId: string,
  actor: AuditActor,
  isActive: boolean,
) {
  const row = await db.registryRow.findFirst({ where: { id: rowId, orgId } });
  if (!row) throw new OrgError("Registry row not found (platform defaults are read-only)", "NOT_FOUND", 404);

  const updated = await db.registryRow.update({ where: { id: rowId }, data: { isActive } });

  await logAudit({
    actor,
    action: isActive ? "org_registry_enabled" : "org_registry_disabled",
    target: { type: "registry_row", id: rowId },
    after: { kind: row.kind, key: row.key },
  });

  return updated;
}

// ── Study analytics (O7) ────────────────────────────────────────────────

/** Org engagement aggregate: activity by day + event mix + active
 *  learners, scoped to the org's members (EngagementEvent rows). */
export async function getOrgAnalytics(orgId: string) {
  const memberIds = await db.orgMember.findMany({
    where: { orgId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);
  if (userIds.length === 0) {
    return { kpis: { events: 0, activeLearners: 0, sessions: 0 }, daily: [], byType: [] };
  }

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [events, sessions] = await Promise.all([
    db.engagementEvent.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: since } },
      select: { userId: true, eventType: true, createdAt: true },
    }),
    db.examSession.count({ where: { userId: { in: userIds }, startedAt: { gte: since } } }),
  ]);

  // Daily activity bars (last 14 days).
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    if (dailyMap.has(day)) dailyMap.set(day, dailyMap.get(day)! + 1);
  }

  const byTypeMap = new Map<string, number>();
  for (const e of events) {
    byTypeMap.set(e.eventType, (byTypeMap.get(e.eventType) ?? 0) + 1);
  }

  return {
    kpis: {
      events: events.length,
      activeLearners: new Set(events.map((e) => e.userId)).size,
      sessions,
    },
    daily: [...dailyMap.entries()].map(([date, count]) => ({ date, count })),
    byType: [...byTypeMap.entries()]
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

// ── Billing (O6) ────────────────────────────────────────────────────────

/** Org billing view: plan + seats usage + recent member payments. */
export async function getOrgBilling(orgId: string) {
  const { org, members, seatsUsed } = await listMembers(orgId);
  const memberIds = members.map((m) => m.userId);

  const payments = await db.payment.findMany({
    where: { userId: { in: memberIds }, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { course: { select: { name: true } } },
  });

  return {
    plan: org.plan,
    seats: org.seats,
    seatsUsed,
    seatsPct: org.seats > 0 ? Math.round((seatsUsed / org.seats) * 100) : 0,
    recentPayments: payments.map((p) => ({
      id: p.id,
      courseName: p.course.name,
      amount: p.amount,
      currency: p.currency,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
