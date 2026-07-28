import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/** GET /api/audit-log — list audit log entries.
 *  Admins see all. Staff see only their own. Students/pending: 403. */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.COURSE_COORDINATOR,
    UserRole.COUNSELOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const url = req.nextUrl;
  const action = url.searchParams.get("action") || undefined;
  const targetType = url.searchParams.get("targetType") || undefined;
  const targetId = url.searchParams.get("targetId") || undefined;
  const requestedActorId = url.searchParams.get("actorId") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const isAdmin = hasRole(ctx.payload.role, ADMIN_ROLES);
  const effectiveActorId = isAdmin ? requestedActorId : ctx.payload.sub;

  const where: { action?: string; targetType?: string; targetId?: string; actorUserId?: string } = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (effectiveActorId) where.actorUserId = effectiveActorId;

  try {
    const [entries, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
      db.auditLog.count({ where }),
    ]);
    const parsed = entries.map(e => {
      const safeParse = (s: string | null) => {
        if (!s) return null;
        try { return JSON.parse(s); } catch { return s; }
      };
      return {
        id: e.id, actorUserId: e.actorUserId, actorName: e.actorName, actorRole: e.actorRole,
        action: e.action, targetType: e.targetType, targetId: e.targetId,
        before: safeParse(e.beforeJson),
        after: safeParse(e.afterJson),
        metadata: safeParse(e.metadata),
        ipAddress: e.ipAddress, createdAt: e.createdAt.toISOString(),
      };
    });
    return NextResponse.json({ entries: parsed, total });
  } catch (err) {
    logger.error("Audit log query failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
