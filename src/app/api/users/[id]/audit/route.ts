import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { getUserAuditProfile, AuditDirection } from "@/modules/user-audit";
import { logger } from "@/lib/logger";

/**
 * GET /api/users/[id]/audit — full audit trail for a user.
 *
 * Returns ALL audit log entries that mention this user, in two categories:
 *   - actionsBy: actions this user performed (actorUserId = id)
 *   - actionsAbout: actions targeting this user (targetType="user", targetId=id)
 *
 * Also includes AI usage logs + activity summary.
 *
 * Access control:
 *   - Students: can only view their own audit trail
 *   - Teachers: can view audit for students in their batch
 *   - Counsellors: can view audit for any student (wellbeing scope)
 *   - Principal + Administrator: can view ANY user's audit trail
 *
 * Query params:
 *   - page: 1-indexed page number (default 1)
 *   - pageSize: items per page (default 50, max 200)
 *   - direction: "by" | "about" | "all" (default "all")
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const isPrivileged = hasRole(payload.role, ADMIN_ROLES);
  if (!isPrivileged) {
    try {
      await assertCanAccessStudent(payload, id);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }

  // Parse query params
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10)));
  const direction = (url.searchParams.get("direction") || "all") as AuditDirection;

  const profile = await getUserAuditProfile(id, { page, pageSize, direction });
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: profile.user,
    auditLogs: profile.auditTrail.entries,
    pagination: {
      page: profile.auditTrail.page,
      pageSize: profile.auditTrail.pageSize,
      total: profile.auditTrail.total,
      totalPages: profile.auditTrail.totalPages,
    },
    aiUsage: profile.aiUsage,
    activity: profile.activity,
    permissions: {
      canViewFullAudit: isPrivileged,
      isViewingSelf: payload.sub === id,
    },
  });
}
