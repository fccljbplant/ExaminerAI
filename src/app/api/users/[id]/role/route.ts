import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { invalidateAuthCache } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PATCH /api/users/[id]/role — change a user's role. Admin only.
 *  Phase RBAC+AUDIT: centralized RBAC + universal audit log. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("changing user roles"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role as string | undefined;
  const reason = body.reason as string | undefined;

  const VALID_ROLES = [
    "pending", "student", "teacher", "course_coordinator",
    "counselor", "guardian", "principal", "administrator", "developer",
    // Legacy aliases (normalized to canonical on read via normalizeRole)
    "institution_admin", "platform_admin", "admin",
  ];
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Normalize legacy aliases to canonical form before persisting
  const { normalizeRole } = await import("@/lib/rbac");
  const canonicalRole = normalizeRole(role) || role;

  const before = await db.user.findUnique({ where: { id }, select: { role: true, name: true, email: true } });
  if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (before.role === canonicalRole) return NextResponse.json({ error: `User is already ${canonicalRole}` }, { status: 400 });
  // M7-security: prevent self-demotion (accidental lockout)
  if (id === auth.ctx.payload.sub) {
    return NextResponse.json({ error: "You cannot change your own role — ask another admin" }, { status: 400 });
  }

  // Finding-1-fix: Elevation matrix — restrict which roles each actor
  // can assign. Prevents an administrator from granting developer access
  // to themselves or others (privilege escalation).
  const ELEVATION_MATRIX: Record<string, string[]> = {
    // principal can assign any role except developer
    principal: ["pending", "student", "teacher", "course_coordinator", "counselor", "guardian", "principal", "administrator"],
    // administrator can assign any role except developer + principal
    administrator: ["pending", "student", "teacher", "course_coordinator", "counselor", "guardian", "administrator"],
    // developer can assign any role (full trust)
    developer: ["pending", "student", "teacher", "course_coordinator", "counselor", "guardian", "principal", "administrator", "developer"],
  };
  const callerRole = auth.ctx.payload.role;
  const allowedTargets = ELEVATION_MATRIX[callerRole] || [];
  if (!allowedTargets.includes(canonicalRole)) {
    return NextResponse.json({
      error: `Your role (${callerRole}) cannot assign the ${canonicalRole} role. Only a developer can grant developer/principal access.`,
    }, { status: 403 });
  }

  const user = await db.user.update({ where: { id }, data: { role: canonicalRole } });

  // R4-fix: invalidate the auth cache so the role change takes effect
  // immediately (within 60s instead of 7 days when only relying on JWT).
  invalidateAuthCache(id);

  await logAudit({
    actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
    action: AuditAction.ROLE_ASSIGNED, target: { type: "user", id },
    before: { role: before.role }, after: { role: canonicalRole },
    metadata: { targetName: before.name, targetEmail: before.email, reason: reason ?? null }, req,
  });

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
