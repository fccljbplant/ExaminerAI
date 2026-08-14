/**
 * modules/org-portal/lib/org-db.ts — W7 org-portal DB wrapper
 *
 * The ONLY file in the org subsystem that imports `db`. All org v2
 * routes go through here: member management (invite/deactivate with
 * audit rows), org settings (portal flags + branding in Setting rows,
 * following the org-theme:<orgId> convention from migrate-org-themes),
 * and the audit feed scoped to the org's own members.
 */

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
 *  convention, idempotent) + portal flag switches (global rows, the same
 *  keys the layouts read). Audited. */
export async function updateOrgSettings(
  orgId: string,
  actor: AuditActor,
  input: { branding?: BrandingInput; flags?: Record<string, boolean> },
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

  if (input.flags) {
    for (const [name, enabled] of Object.entries(input.flags)) {
      const key = `feature_portal_${name}_v2`;
      await db.setting.upsert({
        where: { key },
        update: { value: String(enabled) },
        create: { key, value: String(enabled) },
      });
      changes.push(key);
    }
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
