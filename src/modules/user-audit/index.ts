/**
 * User Audit Module — per-user audit trail + activity summary.
 *
 * This is the CANONICAL module for user audit functionality.
 * Components + API routes should import from here, not from scattered
 * inline implementations.
 *
 * Exports:
 *   - getUserAuditTrail(userId, options): full audit trail (actions BY + ABOUT)
 *   - getUserActivitySummary(userId): activity counts (tests, tasks, AI)
 *   - getUserAIUsage(userId): AI usage breakdown (last 30 days by feature)
 *   - AuditDirection type: "by" | "about" | "all"
 *   - AuditTrailEntry interface
 *   - ActivitySummary interface
 *   - AIUsageSummary interface
 *
 * Access control is handled by the CALLER (API route), not by this module.
 * The module assumes the caller has already verified access.
 */

import { db } from "@/lib/db";

export type AuditDirection = "by" | "about" | "all";

export interface AuditTrailEntry {
  id: string;
  actorName: string;
  actorRole: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  direction: "by" | "about";
}

export interface AuditTrailResult {
  entries: AuditTrailEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivitySummary {
  completedTests: number;
  completedTasks: number;
  totalTasks: number;
  projectReports: number;
  comments: number;
}

export interface AIUsageSummary {
  last30Days: Record<string, { total: number; success: number; failed: number; tokens: number }>;
  totalCalls: number;
  todayCount: number;
  recent: Array<{
    feature: string;
    provider: string;
    success: boolean;
    tokens: number;
    createdAt: string;
  }>;
}

export interface UserAuditProfile {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    currentWeek: number;
    currentDay: number;
    selfPacedEnabled: boolean;
  };
  auditTrail: AuditTrailResult;
  activity: ActivitySummary;
  aiUsage: AIUsageSummary;
}

/** Fetch a user's audit trail (actions BY + ABOUT them), paginated. */
export async function getUserAuditTrail(
  userId: string,
  options: { page?: number; pageSize?: number; direction?: AuditDirection } = {}
): Promise<AuditTrailResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 50));
  const direction = options.direction ?? "all";

  const where = direction === "by"
    ? { actorUserId: userId }
    : direction === "about"
    ? { targetType: "user", targetId: userId }
    : {
        OR: [
          { actorUserId: userId },
          { targetType: "user", targetId: userId },
        ],
      };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const entries: AuditTrailEntry[] = logs.map(log => {
    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;
    let metadata: Record<string, unknown> | null = null;
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
      direction: log.actorUserId === userId ? "by" as const : "about" as const,
    };
  });

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Fetch a user's activity summary (counts of key entities). */
export async function getUserActivitySummary(userId: string): Promise<ActivitySummary> {
  const [
    completedTests,
    tasks,
    projectReports,
    comments,
  ] = await Promise.all([
    db.weeklyTest.count({ where: { userId, status: "completed" } }).catch(() => 0),
    db.projectTask.findMany({
      where: { userId },
      select: { status: true },
    }).catch(() => []),
    db.projectReport.count({ where: { userId } }).catch(() => 0),
    db.comment.count({ where: { studentId: userId } }).catch(() => 0),
  ]);

  return {
    completedTests,
    completedTasks: tasks.filter(t => t.status === "completed").length,
    totalTasks: tasks.length,
    projectReports,
    comments,
  };
}

/** Fetch a user's AI usage summary (last 30 days by feature). */
export async function getUserAIUsage(userId: string): Promise<AIUsageSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [aiLogs, todayCount] = await Promise.all([
    db.aIUsageLog.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { feature: true, provider: true, success: true, promptTokens: true, completionTokens: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }).catch(() => []),
    db.aIUsageLog.count({
      where: { userId, createdAt: { gte: startOfToday }, success: true },
    }).catch(() => 0),
  ]);

  const last30Days: Record<string, { total: number; success: number; failed: number; tokens: number }> = {};
  for (const log of aiLogs) {
    if (!last30Days[log.feature]) {
      last30Days[log.feature] = { total: 0, success: 0, failed: 0, tokens: 0 };
    }
    last30Days[log.feature].total++;
    if (log.success) last30Days[log.feature].success++;
    else last30Days[log.feature].failed++;
    last30Days[log.feature].tokens += (log.promptTokens || 0) + (log.completionTokens || 0);
  }

  return {
    last30Days,
    totalCalls: aiLogs.length,
    todayCount,
    recent: aiLogs.slice(0, 20).map(l => ({
      feature: l.feature,
      provider: l.provider,
      success: l.success,
      tokens: (l.promptTokens || 0) + (l.completionTokens || 0),
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

/** Fetch the complete user audit profile (trail + activity + AI usage). */
export async function getUserAuditProfile(
  userId: string,
  options: { page?: number; pageSize?: number; direction?: AuditDirection } = {}
): Promise<UserAuditProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      currentWeek: true, currentDay: true, selfPacedEnabled: true,
    },
  }).catch(() => null);

  if (!user) return null;

  const [auditTrail, activity, aiUsage] = await Promise.all([
    getUserAuditTrail(userId, options),
    getUserActivitySummary(userId),
    getUserAIUsage(userId),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      currentWeek: user.currentWeek,
      currentDay: user.currentDay,
      selfPacedEnabled: user.selfPacedEnabled,
    },
    auditTrail,
    activity,
    aiUsage,
  };
}
