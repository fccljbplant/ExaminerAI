import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { invalidateAuthCache } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** PATCH /api/users/[id]/role — change a user's role. Admin only.
 *  Phase RBAC+AUDIT: centralized RBAC + universal audit log.
 *
 *  Role-assignment policy (post-purge 2026-08, 4-role model):
 *  - platform_admin: full user-management authority. Can assign ANY role
 *    including org_admin and demo. This is the platform administration role.
 *  - org_admin: organization-head authority. Can assign any role except
 *    demo (demo is a system-level preview account, not org-scoped).
 *  - demo: READ-ONLY. Cannot assign roles at all. Demo is just for demo.
 *    Removed from requireRole so the endpoint refuses the call before
 *    the elevation matrix is even consulted. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("changing user roles"); if (_demoBlock) return _demoBlock;
  // Demo is deliberately NOT in this list — demo is read-only and has no
  // role-assignment authority whatsoever.
  const auth = await requireRole([UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role as string | undefined;
  const reason = body.reason as string | undefined;

  const VALID_ROLES = [
    // Canonical 4-role model + demo (post-purge 2026-08)
    "learner", "instructor", "org_admin", "platform_admin", "demo",
    // Legacy aliases (normalized to canonical on read via normalizeRole)
    "student", "coordinator", "principal", "institution_admin",
    "administrator", "platform_admin", "admin",
    "teacher", "teaching_assistant", "course_coordinator",
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

  // Elevation matrix — restrict which roles each actor can assign.
  // - platform_admin: full authority (can assign any role including demo
  //   and org_admin). This is the platform administration role.
  // - org_admin: organization-head authority. Can assign any role except
  //   demo (demo is system-level, not org-scoped).
  // - demo: NOT in requireRole, so never reaches this matrix.
  const ELEVATION_MATRIX: Record<string, string[]> = {
    platform_admin: ["learner", "instructor", "org_admin", "platform_admin", "demo"],
    org_admin:      ["learner", "instructor", "org_admin", "platform_admin"],
  };
  const callerRole = auth.ctx.payload.role;
  const normalizedCaller = normalizeRole(callerRole);
  const matrixKey = normalizedCaller === UserRole.PLATFORM_ADMIN ? "platform_admin"
    : normalizedCaller === UserRole.ORG_ADMIN ? "org_admin"
    : callerRole;
  const allowedTargets = ELEVATION_MATRIX[matrixKey] || [];
  if (!allowedTargets.includes(canonicalRole)) {
    return NextResponse.json({
      error: `Your role (${callerRole}) cannot assign the ${canonicalRole} role. Only a platform admin can grant demo access.`,
    }, { status: 403 });
  }

  const user = await db.user.update({ where: { id }, data: { role: canonicalRole } });

  // Sync CourseEnrollment role when changing between learner and instructor.
  // CourseEnrollment still uses the legacy strings "student" / "instructor"
  // (per project rules — they're normalized via normalizeRole on read).
  const enrollmentRole = canonicalRole === "instructor" ? "instructor"
    : canonicalRole === "learner" ? "student" : null;
  if (enrollmentRole) {
    // Update existing enrollments to match the new role
    const existingEnrollments = await db.courseEnrollment.findMany({
      where: { userId: id, role: enrollmentRole === "instructor" ? "student" : "instructor" },
    });
    if (existingEnrollments.length > 0) {
      // Delete old-role enrollments (they'll be recreated as needed)
      await db.courseEnrollment.deleteMany({
        where: { id: { in: existingEnrollments.map(e => e.id) } },
      });
    }
  } else if (canonicalRole !== "learner" && canonicalRole !== "instructor") {
    // Non-learner/instructor roles: remove all course enrollments
    await db.courseEnrollment.deleteMany({ where: { userId: id } });
  }

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
