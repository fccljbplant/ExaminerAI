import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, ADMIN_ROLES, hasRole, type DataScope } from "@/lib/rbac";
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

  const isAdmin = hasRole(ctx.payload.role, ADMIN_ROLES);
  const effectiveGrantee = isAdmin ? requestedGrantee : ctx.payload.sub;

  const where: { granteeUserId?: string; scopeType?: string; scopeId?: string; revokedAt?: null } = { revokedAt: null };
  if (effectiveGrantee) where.granteeUserId = effectiveGrantee;
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
  const VALID_SCOPE_TYPES = ["batch", "student", "course", "institution"];
  if (!VALID_SCOPE_TYPES.includes(scopeType)) {
    return NextResponse.json({ error: "Invalid scopeType" }, { status: 400 });
  }
  const VALID_DATA_SCOPES = ["full", "wellbeing_only", "crisis_only", "content_only"];
  const effectiveDataScope: DataScope = (dataScope && VALID_DATA_SCOPES.includes(dataScope))
    ? dataScope as DataScope : "full";

  const grantee = await db.user.findUnique({
    where: { id: granteeUserId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!grantee) return NextResponse.json({ error: "Grantee user not found" }, { status: 404 });

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
