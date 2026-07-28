import { hasRole, ADMIN_ROLES, isStaffRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, invalidateAuthCache } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PUT /api/users/[id]/block — block or unblock a user.
 *  Body: { blocked: boolean }
 *  Teacher can block/unblock students. Admin can block/unblock anyone except other admins.
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

  // Check target user
  const target = await db.user.findUnique({ where: { id }, select: { role: true, email: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Teachers, TAs, course_coordinators, and counselors can only block
  // student/pending accounts — they must not be able to block other staff.
  if ((payload.role === "instructor" || payload.role === "teacher" || payload.role === "course_coordinator" || payload.role === "counselor") && target.role !== "student" && target.role !== "pending") {
    return NextResponse.json({ error: "You can only block student or pending accounts" }, { status: 403 });
  }

  // Nobody blocks admins
  // Use hasRole to catch all admin roles (administrator, principal, admin legacy)
  if (hasRole(target.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Cannot block admin accounts" }, { status: 403 });
  }
  // Finding-1-fix: prevent self-block (accidental lockout)
  if (id === payload.sub) {
    return NextResponse.json({ error: "You cannot block your own account" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id },
    data: { blocked },
  });

  // R4-fix: invalidate the auth cache so the block takes effect immediately
  // (within 60s instead of 7 days when only relying on JWT expiry).
  invalidateAuthCache(id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, blocked: user.blocked },
    message: blocked ? "User blocked — they cannot log in until unblocked." : "User unblocked.",
  });
}
