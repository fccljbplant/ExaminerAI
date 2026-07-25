import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";

/**
 * GET /api/users/[id]/audit — full audit trail for a user.
 *
 * Returns ALL audit log entries that mention this user, in two categories:
 *   - actionsBy: actions this user performed (actorUserId = id)
 *   - actionsAbout: actions targeting this user (targetType="user", targetId=id)
 *
 * Also includes AI usage logs (from AIUsageLog) so admin/principal can see
 * every AI call this user made (with timestamps, feature, tokens, success).
 *
 * Access control:
 *   - Students: can only view their own audit trail
 *   - Teachers: can view audit for students in their batch
 *   - Counsellors: can view audit for any student (wellbeing scope)
 *   - Principal + Administrator: can view ANY user's audit trail (including
 *     teachers, counselors, other admins — full institutional oversight)
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

  // Access control — who can view this user's audit trail?
  const isPrivileged = hasRole(payload.role, ADMIN_ROLES);
  // For non-admin roles, use assertCanAccessStudent (handles batch scoping).
  // For admin/principal roles, skip the student check — they can view ANY user.
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
  const direction = (url.searchParams.get("direction") || "all") as "by" | "about" | "all";

  // Fetch the user (so we can show their name + role in the response)
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  }).catch(() => null);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Build the where clause for AuditLog
  // "by" = actions this user performed
  // "about" = actions targeting this user
  // "all" = both, combined
  const auditWhere = direction === "by"
    ? { actorUserId: id }
    : direction === "about"
    ? { targetType: "user", targetId: id }
    : {
        OR: [
          { actorUserId: id },
          { targetType: "user", targetId: id },
        ],
      };

  // Fetch audit logs + count in parallel
  const [auditTotal, auditLogs] = await Promise.all([
    db.auditLog.count({ where: auditWhere }),
    db.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Fetch AI usage summary (last 30 days) — counts by feature + category
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const aiUsageLogs = await db.aIUsageLog.findMany({
    where: { userId: id, createdAt: { gte: thirtyDaysAgo } },
    select: { feature: true, provider: true, success: true, promptTokens: true, completionTokens: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100, // last 100 AI calls
  }).catch(() => []);

  // AI usage summary by feature
  const aiByFeature: Record<string, { total: number; success: number; failed: number; tokens: number }> = {};
  for (const log of aiUsageLogs) {
    if (!aiByFeature[log.feature]) {
      aiByFeature[log.feature] = { total: 0, success: 0, failed: 0, tokens: 0 };
    }
    aiByFeature[log.feature].total++;
    if (log.success) aiByFeature[log.feature].success++;
    else aiByFeature[log.feature].failed++;
    aiByFeature[log.feature].tokens += (log.promptTokens || 0) + (log.completionTokens || 0);
  }

  // Today's AI usage (for rate-limit display)
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const todayAiCount = await db.aIUsageLog.count({
    where: { userId: id, createdAt: { gte: startOfToday }, success: true },
  }).catch(() => 0);

  // Fetch related activity counts (mentorship touchpoints, alerts, etc.)
  const [touchpointCount, alertCountAsTarget, crisisFlagCount, testCount] = await Promise.all([
    db.mentorshipTouchpoint.count({ where: { userId: id } }).catch(() => 0),
    db.studentAlert.count({ where: { userId: id } }).catch(() => 0),
    db.crisisFlag.count({ where: { userId: id } }).catch(() => 0),
    db.weeklyTest.count({ where: { userId: id, status: "completed" } }).catch(() => 0),
  ]);

  // Format audit logs for the response
  const formattedLogs = auditLogs.map(log => {
    let before: any = null;
    let after: any = null;
    let metadata: any = null;
    try { if (log.beforeJson) before = JSON.parse(log.beforeJson); } catch { /* keep null */ }
    try { if (log.afterJson) after = JSON.parse(log.afterJson); } catch { /* keep null */ }
    try { if (log.metadata) metadata = JSON.parse(log.metadata); } catch { /* keep null */ }
    return {
      id: log.id,
      actorName: log.actorName,
      actorRole: log.actorRole,
      actorUserId: log.actorUserId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      before,
      after,
      metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
      // "direction" helps the UI show whether this was an action BY or ABOUT the user
      direction: log.actorUserId === id ? "by" : "about",
    };
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    auditLogs: formattedLogs,
    pagination: {
      page,
      pageSize,
      total: auditTotal,
      totalPages: Math.ceil(auditTotal / pageSize),
    },
    aiUsage: {
      last30Days: aiByFeature,
      totalCalls: aiUsageLogs.length,
      todayCount: todayAiCount,
      recent: aiUsageLogs.slice(0, 20).map(l => ({
        feature: l.feature,
        provider: l.provider,
        success: l.success,
        tokens: (l.promptTokens || 0) + (l.completionTokens || 0),
        createdAt: l.createdAt.toISOString(),
      })),
    },
    activity: {
      mentorshipTouchpoints: touchpointCount,
      alerts: alertCountAsTarget,
      crisisFlags: crisisFlagCount,
      completedTests: testCount,
    },
    // Permission flags for the UI
    permissions: {
      canViewFullAudit: isPrivileged,
      isViewingSelf: payload.sub === id,
    },
  });
}
