import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { invalidateAuthCache } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PATCH /api/users/[id]/role — change a user's role. Admin only.
 *  Phase RBAC+AUDIT: centralized RBAC + universal audit log.
 *
 *  Role-assignment policy (clarified 2026-07-25):
 *  - administrator: full user-management authority. Can assign ANY role
 *    including principal and demo. This is the administration role.
 *  - principal: institution-head authority. Can assign any role except
 *    demo (demo is a system-level preview account, not institution-scoped).
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
  const auth = await requireRole([UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role as string | undefined;
  const reason = body.reason as string | undefined;

  const VALID_ROLES = [
    "pending", "student", "instructor", "course_coordinator",
    "counselor", "guardian", "principal", "administrator", "demo",
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

  // Elevation matrix — restrict which roles each actor can assign.
  // - administrator: full authority (can assign any role including demo
  //   and principal). This is the administration role.
  // - principal: institution-head authority. Can assign any role except
  //   demo (demo is system-level, not institution-scoped).
  // - demo: NOT in requireRole, so never reaches this matrix.
  const ELEVATION_MATRIX: Record<string, string[]> = {
    administrator: ["pending", "student", "instructor", "course_coordinator", "counselor", "guardian", "principal", "administrator", "demo"],
    principal: ["pending", "student", "instructor", "course_coordinator", "counselor", "guardian", "principal", "administrator"],
  };
  const callerRole = auth.ctx.payload.role;
  const allowedTargets = ELEVATION_MATRIX[callerRole] || [];
  if (!allowedTargets.includes(canonicalRole)) {
    return NextResponse.json({
      error: `Your role (${callerRole}) cannot assign the ${canonicalRole} role. Only an administrator can grant demo access.`,
    }, { status: 403 });
  }

  const user = await db.user.update({ where: { id }, data: { role: canonicalRole } });

  // Sync CourseEnrollment role when changing between student and instructor
  const enrollmentRole = canonicalRole === "instructor" ? "instructor"
    : canonicalRole === "student" ? "student" : null;
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
  } else if (canonicalRole !== "student" && canonicalRole !== "instructor") {
    // Non-student/instructor roles: remove all course enrollments
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
