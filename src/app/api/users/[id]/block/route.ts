import { hasRole, ADMIN_ROLES, isStaffRole, UserRole, normalizeRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, invalidateAuthCache } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** PUT /api/users/[id]/block — block or unblock a user.
 *  Body: { blocked: boolean }
 *  Instructors can block/unblock learners. Admins can block/unblock anyone except other admins.
 *  Demo is read-only and cannot block/unblock anyone. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("blocking users"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || payload.role === UserRole.DEMO) {
    // Demo is read-only — cannot block/unblock anyone, even though it's a
    // "staff" role for preview purposes.
    return NextResponse.json({ error: "Demo accounts cannot modify users" }, { status: 403 });
  }
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blocked = Boolean(body.blocked);
  // Optional ban reason (2026-08-17 SaaS support): recorded on block,
  // cleared on unblock. Surfaced in the support/user audit surfaces.
  const reason = typeof body.reason === "string" && body.reason.trim()
    ? body.reason.trim().slice(0, 300)
    : null;

  // Check target user
  const target = await db.user.findUnique({ where: { id }, select: { role: true, email: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Instructors can only block learner accounts — they must not be able
  // to block other staff.
  if (normalizeRole(payload.role) === UserRole.INSTRUCTOR && normalizeRole(target.role) !== UserRole.LEARNER) {
    return NextResponse.json({ error: "You can only block learner accounts" }, { status: 403 });
  }

  // Nobody blocks admins
  // Use hasRole to catch all admin roles (org_admin, platform_admin, demo legacy)
  if (hasRole(target.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Cannot block admin accounts" }, { status: 403 });
  }
  // Finding-1-fix: prevent self-block (accidental lockout)
  if (id === payload.sub) {
    return NextResponse.json({ error: "You cannot block your own account" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id },
    data: {
      blocked,
      banReason: blocked ? reason : null,
      banExpiresAt: null,
      // User.status "suspended" is enforced by the login route — write it
      // so bans take effect at the status gate as well as the flag
      // (2026-08-17).
      status: blocked ? "suspended" : "active",
    },
  });

  // R4-fix: invalidate the auth cache so the block takes effect immediately
  // (within 60s instead of 7 days when only relying on JWT expiry).
  invalidateAuthCache(id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, blocked: user.blocked },
    message: blocked ? "User blocked — they cannot log in until unblocked." : "User unblocked.",
  });
}
