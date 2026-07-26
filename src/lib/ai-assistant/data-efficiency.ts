/**
 * AI Assistant — Data Efficiency (Section 2)
 *
 * 2a. AICache activation — store rolling per-entity summaries, keyed by
 *     entity + version/timestamp. Assistant calls read cached summaries
 *     for anything older than the current week; only current week's data
 *     gets freshly queried and folded in.
 *
 * 2b. Aggregate-first for institution-wide queries — hit pre-aggregated
 *     SQL (counts, averages, distributions), never raw student-level rows
 *     across the whole institution in one prompt. Two-tier: first query
 *     is aggregate, if specifics needed → second narrower query.
 *
 * 2c. AIUsageLog soft per-role query budget — flag unusually high usage
 *     for review, do not hard-block.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ScopeResult } from "./scope";

/** Max raw entity records sent to the model in one call (Section 2b) */
export const MAX_ENTITY_RECORDS_PER_CALL = 50;

/** Cache window: 7 days (anything older than current week is cached) */
const CACHE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Per-role soft query budget (per 24h) — flags, doesn't block */
const ROLE_QUERY_BUDGETS: Record<string, number> = {
  teacher: 50,
  teaching_assistant: 30,
  counselor: 80,
  course_coordinator: 40,
  principal: 200,
  administrator: 200,
  demo: 100,
};

// ============================================================
// 2a. CACHE LAYER
// ============================================================

/**
 * Get a cached entity summary if it exists and is within the cache window.
 * Returns null if no cache or cache is stale.
 */
export async function getCachedSummary(
  entityType: "student" | "teacher" | "batch" | "institution",
  entityId: string
): Promise<string | null> {
  const cacheKey = `assistant-summary:${entityType}:${entityId}`;

  const cached = await db.aICache.findUnique({
    where: { cacheKey },
  });

  if (!cached) return null;

  const age = Date.now() - cached.createdAt.getTime();
  if (age > CACHE_WINDOW_MS) {
    // Cache is stale — return null so caller fetches fresh data
    return null;
  }

  logger.info("AI Assistant cache hit", { entityType, entityId, age: Math.round(age / 1000) + "s" });
  return cached.response;
}

/**
 * Store an entity summary in the cache (upsert).
 */
export async function setCachedSummary(
  entityType: "student" | "teacher" | "batch" | "institution",
  entityId: string,
  summary: string,
  provider: string = "system",
  promptTokens: number = 0
): Promise<void> {
  const cacheKey = `assistant-summary:${entityType}:${entityId}`;

  await db.aICache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      response: summary,
      provider,
      promptTokens,
      hitCount: 0,
    },
    update: {
      response: summary,
      provider,
      promptTokens,
      // Don't reset hitCount — it tracks total cache hits
    },
  });
}

/**
 * Check if a cached summary is from the current week.
 * If yes → use cached + fold in current-week data.
 * If no → fetch fresh.
 */
export function isCacheCurrentWeek(cachedAt: Date): boolean {
  const now = new Date();
  const cacheDate = new Date(cachedAt);
  // Same year and same ISO week number
  const getISOWeek = (d: Date) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  };
  return now.getFullYear() === cacheDate.getFullYear() && getISOWeek(now) === getISOWeek(cacheDate);
}

// ============================================================
// 2b. AGGREGATE-FIRST QUERIES
// ============================================================

/**
 * Build an aggregate summary for a scope (institution-wide or batch-level).
 * Returns counts + averages + distributions — NOT raw student records.
 *
 * This is the FIRST tier of a two-tier query:
 * 1. This function returns aggregate stats
 * 2. If the caller needs specifics, they call getNarrowedEntityData() with
 *    a narrower scope (e.g. one batch)
 */
export async function getAggregateSummary(scope: ScopeResult): Promise<{
  totalStudents: number;
  totalTeachers: number;
  wellbeingDistribution: { green: number; amber: number; red: number };
  alertStats: { open: number; resolved: number; crisis: number };
  avgMood: number;
  avgEngagement: number;
  signalCounts: { frustration: number; avoidance: number; enthusiasm: number };
}> {
  const studentFilter = scope.isInstitutionWide
    ? { role: "student" as const, institutionId: scope.institutionId ?? undefined, blocked: false }
    : { id: { in: scope.studentIds }, blocked: false };

  const [students, teachers, wellbeingStates, alerts, healthSummaries] = await Promise.all([
    db.user.count({ where: studentFilter }),
    db.user.count({ where: { role: "teacher", institutionId: scope.institutionId ?? undefined } }),
    db.wellbeingState.findMany({
      where: { userId: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined } },
      select: { tier: true },
    }),
    db.studentAlert.findMany({
      where: {
        user: { id: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined } },
        status: "open",
      },
      select: { severity: true, status: true },
    }),
    db.studentHealthSummary.findMany({
      where: { userId: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined } },
      select: { moodScore: true, engagementScore: true, frustrationCount: true, avoidanceCount: true, enthusiasmCount: true },
    }),
  ]);

  const moodScores = healthSummaries.map(h => h.moodScore).filter(m => m != null) as number[];
  const engagementScores = healthSummaries.map(h => h.engagementScore).filter(e => e != null) as number[];

  return {
    totalStudents: students,
    totalTeachers: teachers,
    wellbeingDistribution: {
      green: wellbeingStates.filter(w => w.tier === "green").length,
      amber: wellbeingStates.filter(w => w.tier === "warning").length,
      red: wellbeingStates.filter(w => w.tier === "red").length,
    },
    alertStats: {
      open: alerts.length,
      resolved: 0, // Would need a separate query for resolved count
      crisis: alerts.filter(a => a.severity === "red").length,
    },
    avgMood: moodScores.length > 0 ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length) : 0,
    avgEngagement: engagementScores.length > 0 ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) : 0,
    signalCounts: {
      frustration: healthSummaries.reduce((s, h) => s + (h.frustrationCount || 0), 0),
      avoidance: healthSummaries.reduce((s, h) => s + (h.avoidanceCount || 0), 0),
      enthusiasm: healthSummaries.reduce((s, h) => s + (h.enthusiasmCount || 0), 0),
    },
  };
}

/**
 * Second tier: get narrowed entity data for a specific batch or subset.
 * Capped at MAX_ENTITY_RECORDS_PER_CALL to prevent giant context dumps.
 */
export async function getNarrowedEntityData(
  scope: ScopeResult,
  batchIds?: string[]
): Promise<{
  students: Array<{ id: string; name: string; currentWeek: number; latestScore: number | null }>;
  totalAvailable: number;
  truncated: boolean;
}> {
  // Determine which student IDs to query
  let targetStudentIds = scope.studentIds;
  if (batchIds && batchIds.length > 0) {
    // Narrow to students in the specified batches
    const batchStudents = await db.user.findMany({
      where: { role: "student", batchId: { in: batchIds }, blocked: false },
      select: { id: true },
    });
    targetStudentIds = batchStudents.map(s => s.id);
  }

  if (targetStudentIds.length === 0) {
    return { students: [], totalAvailable: 0, truncated: false };
  }

  const totalAvailable = targetStudentIds.length;
  const truncated = totalAvailable > MAX_ENTITY_RECORDS_PER_CALL;
  const idsToQuery = truncated ? targetStudentIds.slice(0, MAX_ENTITY_RECORDS_PER_CALL) : targetStudentIds;

  const students = await db.user.findMany({
    where: { id: { in: idsToQuery } },
    select: {
      id: true, name: true, currentWeek: true,
      weeklyTests: { orderBy: { week: "desc" as const }, take: 1, select: { score: true } },
    },
  });

  return {
    students: students.map(s => ({
      id: s.id,
      name: s.name,
      currentWeek: s.currentWeek,
      latestScore: s.weeklyTests[0]?.score ?? null,
    })),
    totalAvailable,
    truncated,
  };
}

// ============================================================
// 2c. SOFT QUERY BUDGET
// ============================================================

/**
 * Check if the caller has exceeded their soft query budget.
 * Returns { exceeded: boolean, usage: number, budget: number }.
 * Does NOT block — just flags for review.
 */
export async function checkQueryBudget(
  callerId: string,
  callerRole: string
): Promise<{ exceeded: boolean; usage: number; budget: number }> {
  const budget = ROLE_QUERY_BUDGETS[callerRole] ?? 50;

  // Count AI usage in the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usage = await db.aIUsageLog.count({
    where: {
      userId: callerId,
      createdAt: { gt: yesterday },
    },
  }).catch(() => 0); // AIUsageLog might not exist in all environments

  return {
    exceeded: usage >= budget,
    usage,
    budget,
  };
}

/**
 * Log an AI usage entry for budget tracking.
 */
export async function logAIUsage(params: {
  userId: string;
  feature: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.aIUsageLog.create({
      data: {
        userId: params.userId,
        feature: params.feature,
        provider: params.provider,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        latencyMs: params.latencyMs,
        success: params.success,
        errorMessage: params.errorMessage ?? null,
      },
    });
  } catch {
    // AIUsageLog might not exist — silent fail
  }
}
