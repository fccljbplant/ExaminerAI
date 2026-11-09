import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, ADMIN_ROLES, hasRole, normalizeRole, type DataScope } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/access-grants — list access grants. Admins see all, staff see own. */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const url = req.nextUrl;
  const requestedGrantee = url.searchParams.get("granteeUserId") || undefined;
  const scopeType = url.searchParams.get("scopeType") || undefined;
  const scopeId = url.searchParams.get("scopeId") || undefined;

  const isPlatformAdmin = hasRole(ctx.payload.role, [UserRole.PLATFORM_ADMIN]);
  const isOrgAdmin = normalizeRole(ctx.payload.role) === UserRole.ORG_ADMIN;
  const effectiveGrantee = isPlatformAdmin ? requestedGrantee : isOrgAdmin ? undefined : ctx.payload.sub;

  const where: { granteeUserId?: string; grantedByUserId?: string; scopeType?: string; scopeId?: string; revokedAt?: null } = { revokedAt: null };
  if (effectiveGrantee) where.granteeUserId = effectiveGrantee;
  // Org admins may inspect grants they issued, not every tenant's grants.
  if (isOrgAdmin) where.grantedByUserId = ctx.payload.sub;
  if (scopeType) where.scopeType = scopeType;
  if (scopeId) where.scopeId = scopeId;

  const grants = await db.accessGrant.findMany({
    where, orderBy: { grantedAt: "desc" },
    include: { grantee: { select: { id: true, name: true, email: true, role: true } } },
  });
  return NextResponse.json({ grants });
}

/** POST /api/access-grants — create/update an access grant. Admin only. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing access grants"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { granteeUserId, scopeType, scopeId, dataScope } = body as {
    granteeUserId?: string; scopeType?: string; scopeId?: string; dataScope?: string;
  };

  if (!granteeUserId || !scopeType || !scopeId) {
    return NextResponse.json({ error: "granteeUserId, scopeType, and scopeId required" }, { status: 400 });
  }
  const VALID_SCOPE_TYPES = ["student", "course", "institution"];
  if (!VALID_SCOPE_TYPES.includes(scopeType)) {
    return NextResponse.json({ error: "Invalid scopeType" }, { status: 400 });
  }
  const VALID_DATA_SCOPES = ["full", "wellbeing_only", "crisis_only", "content_only"];
  if (dataScope !== undefined && !VALID_DATA_SCOPES.includes(dataScope)) {
    return NextResponse.json({ error: "Invalid dataScope" }, { status: 400 });
  }
  const effectiveDataScope: DataScope = dataScope ? dataScope as DataScope : "full";

  const grantee = await db.user.findUnique({
    where: { id: granteeUserId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!grantee) return NextResponse.json({ error: "Grantee user not found" }, { status: 404 });

  // Org admins may only grant access within an organization they actively administer.
  // Platform admins retain cross-tenant control-plane access.
  if (normalizeRole(auth.ctx.payload.role) === UserRole.ORG_ADMIN) {
    const actorMemberships = await db.orgMember.findMany({
      where: { userId: auth.ctx.payload.sub, status: "active", role: "admin" },
      select: { orgId: true },
    });
    const orgIds = actorMemberships.map((membership) => membership.orgId);
    if (orgIds.length === 0) {
      return NextResponse.json({ error: "No active organization-admin scope" }, { status: 403 });
    }

    const granteeMembership = await db.orgMember.findFirst({
      where: { userId: granteeUserId, orgId: { in: orgIds }, status: "active" },
      select: { orgId: true },
    });
    if (!granteeMembership) {
      return NextResponse.json({ error: "Grantee is not an active member of an organization you administer" }, { status: 403 });
    }

    let scopeIsInOrganization = false;
    if (scopeType === "institution") {
      scopeIsInOrganization = orgIds.includes(scopeId);
    } else if (scopeType === "course") {
      const courseLink = await db.orgCourse.findFirst({
        where: { orgId: { in: orgIds }, courseId: scopeId },
        select: { orgId: true },
      });
      scopeIsInOrganization = Boolean(courseLink);
    } else if (scopeType === "student") {
      const studentMembership = await db.orgMember.findFirst({
        where: { userId: scopeId, orgId: { in: orgIds }, status: "active" },
        select: { orgId: true },
      });
      scopeIsInOrganization = Boolean(studentMembership);
    }
    if (!scopeIsInOrganization) {
      return NextResponse.json({ error: "Grant scope is outside your organization" }, { status: 403 });
    }
  }

  const GRANTABLE_ROLES: string[] = [
    UserRole.INSTRUCTOR, "instructor",
  ];
  if (!GRANTABLE_ROLES.includes(grantee.role)) {
    return NextResponse.json({ error: `Role '${grantee.role}' cannot receive access grants` }, { status: 400 });
  }

  try {
    const grant = await db.accessGrant.upsert({
      where: { granteeUserId_scopeType_scopeId: { granteeUserId, scopeType, scopeId } },
      create: { granteeUserId, scopeType, scopeId, dataScope: effectiveDataScope, grantedByUserId: auth.ctx.payload.sub },
      update: { dataScope: effectiveDataScope, revokedAt: null, grantedAt: new Date(), grantedByUserId: auth.ctx.payload.sub },
    });
    await logAudit({
      actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
      action: AuditAction.ACCESS_GRANT_CREATED,
      target: { type: "accessGrant", id: grant.id },
      after: { granteeUserId, granteeName: grantee.name, granteeEmail: grantee.email, scopeType, scopeId, dataScope: effectiveDataScope },
      req,
    });
    return NextResponse.json({ grant });
  } catch (err) {
    logger.error("Access grant creation failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create access grant" }, { status: 500 });
  }
}

/** DELETE /api/access-grants?id=… — revoke a grant (soft: sets revokedAt).
 *  Admin only (2026-08-17 — grants could previously be created but never
 *  revoked via API/UI). */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("revoking access grants"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await db.accessGrant.findUnique({ where: { id }, select: { id: true, revokedAt: true, granteeUserId: true } });
  if (!existing) return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  if (existing.revokedAt) return NextResponse.json({ error: "Grant already revoked" }, { status: 409 });

  const grant = await db.accessGrant.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: AuditAction.ACCESS_GRANT_REVOKED,
    target: { type: "accessGrant", id },
    after: { revoked: true, granteeUserId: existing.granteeUserId },
    req,
  }).catch(() => {});
  return NextResponse.json({ grant });
}
