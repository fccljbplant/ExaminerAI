import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { AI_TOKEN_QUOTA, hasAI, isAIConfigured, getRateLimitStats } from "@/lib/ai-provider";

/** GET /api/ai/stats — AI usage stats for admin dashboard.
 *
 *  Returns:
 *  - cache: hit rate, total entries
 *  - providers: call count per provider
 *  - tokens: prompt / completion / total (from AIUsageLog — accurate)
 *  - quota: { limit, used, left, percentUsed, resetInHours }
 *  - featureBreakdown: tokens per feature (question-gen / evaluate / weekly-test)
 *  - recentErrors: last 5 failed AI calls
 *  - psychObsCount: behavioral records
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // ---- Cache stats (legacy, from AICache table) ----
    const cacheEntries = await db.aICache.findMany({ take: 1000 });
    const totalHits = cacheEntries.reduce((a, c) => a + c.hitCount, 0);
    const totalMisses = cacheEntries.length;
    const cacheHitRate = totalHits + totalMisses > 0 ? Math.round((totalHits / (totalHits + totalMisses)) * 100) : 0;

    const byProviderCache: Record<string, number> = {};
    cacheEntries.forEach(c => { byProviderCache[c.provider] = (byProviderCache[c.provider] || 0) + 1; });

    // ---- Unified usage stats (from AIUsageLog — accurate, all features) ----
    const since = new Date();
    since.setDate(since.getDate() - 1); // last 24h

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30); // last 30 days

    const [
      allLogs,
      recentLogs,
      monthlyLogs,
      failedLogs,
      psychObsCount,
      aiCacheTokens,
    ] = await Promise.all([
      db.aIUsageLog.findMany({ take: 5000, orderBy: { createdAt: "desc" } }),
      db.aIUsageLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
      db.aIUsageLog.findMany({ where: { createdAt: { gte: since30 } }, orderBy: { createdAt: "desc" }, take: 2000 }),
      db.aIUsageLog.findMany({ where: { success: false }, take: 5, orderBy: { createdAt: "desc" } }),
      db.psychologyObs.count().catch(() => 0),
      db.aICache.aggregate({ _sum: { promptTokens: true, completionTokens: true } }).catch(() => ({ _sum: { promptTokens: 0, completionTokens: 0 } })),
    ]);

    // ---- Token totals (all-time from AIUsageLog) ----
    const totalPromptTokens = allLogs.reduce((a, l) => a + l.promptTokens, 0);
    const totalCompletionTokens = allLogs.reduce((a, l) => a + l.completionTokens, 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    // ---- 24h token usage (for quota tracking) ----
    const tokensLast24h = recentLogs.reduce((a, l) => a + l.totalTokens, 0);
    const callsLast24h = recentLogs.length;
    const successfulCalls24h = recentLogs.filter(l => l.success).length;

    // ---- 30-day stats (for trend) ----
    const tokensLast30d = monthlyLogs.reduce((a, l) => a + l.totalTokens, 0);
    const callsLast30d = monthlyLogs.length;

    // ---- Provider breakdown (from AIUsageLog) ----
    const byProvider: Record<string, { calls: number; tokens: number; successes: number }> = {};
    allLogs.forEach(l => {
      if (!byProvider[l.provider]) byProvider[l.provider] = { calls: 0, tokens: 0, successes: 0 };
      byProvider[l.provider].calls++;
      byProvider[l.provider].tokens += l.totalTokens;
      if (l.success) byProvider[l.provider].successes++;
    });

    // ---- Feature breakdown ----
    const byFeature: Record<string, { calls: number; tokens: number }> = {};
    allLogs.forEach(l => {
      if (!byFeature[l.feature]) byFeature[l.feature] = { calls: 0, tokens: 0 };
      byFeature[l.feature].calls++;
      byFeature[l.feature].tokens += l.totalTokens;
    });

    // ---- Quota tracking ----
    const quotaLimit = AI_TOKEN_QUOTA;
    const quotaUsed = tokensLast24h;
    const quotaLeft = Math.max(0, quotaLimit - quotaUsed);
    const percentUsed = quotaLimit > 0 ? Math.round((quotaUsed / quotaLimit) * 100) : 0;

    // Time until quota resets (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const resetInHours = Math.max(0, Math.round((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60)));

    // ---- Avg latency per provider ----
    const latencyByProvider: Record<string, { avgMs: number; count: number }> = {};
    allLogs.forEach(l => {
      if (!latencyByProvider[l.provider]) latencyByProvider[l.provider] = { avgMs: 0, count: 0 };
      latencyByProvider[l.provider].avgMs += l.durationMs;
      latencyByProvider[l.provider].count++;
    });
    Object.keys(latencyByProvider).forEach(p => {
      latencyByProvider[p].avgMs = latencyByProvider[p].count > 0
        ? Math.round(latencyByProvider[p].avgMs / latencyByProvider[p].count)
        : 0;
    });

    return NextResponse.json({
      cache: { totalEntries: totalMisses, totalHits, totalMisses, hitRate: cacheHitRate },
      providers: byProviderCache,
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalTokens,
        // Legacy cached-only tokens (kept for backward compat)
        cachedOnly: {
          prompt: aiCacheTokens._sum.promptTokens ?? 0,
          completion: aiCacheTokens._sum.completionTokens ?? 0,
        },
      },
      quota: {
        limit: quotaLimit,
        used: quotaUsed,
        left: quotaLeft,
        percentUsed,
        resetInHours,
        period: "24h",
      },
      usage24h: {
        tokens: tokensLast24h,
        calls: callsLast24h,
        successfulCalls: successfulCalls24h,
        successRate: callsLast24h > 0 ? Math.round((successfulCalls24h / callsLast24h) * 100) : 100,
      },
      usage30d: {
        tokens: tokensLast30d,
        calls: callsLast30d,
      },
      providerBreakdown: byProvider,
      featureBreakdown: byFeature,
      latencyByProvider,
      recentErrors: failedLogs.map(l => ({
        provider: l.provider,
        feature: l.feature,
        error: l.errorMessage ?? "Unknown error",
        at: l.createdAt,
      })),
      psychObsCount,
      aiConfigured: await isAIConfigured(),
      aiModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      aiProvider: "deepseek",
      rateLimits: getRateLimitStats(),
    });
  } catch (e) {
    // If AIUsageLog table doesn't exist yet (pre-migration), return a
    // graceful fallback so the dashboard still renders.
    return NextResponse.json({
      cache: { totalEntries: 0, totalHits: 0, totalMisses: 0, hitRate: 0 },
      providers: {},
      tokens: { prompt: 0, completion: 0, total: 0, cachedOnly: { prompt: 0, completion: 0 } },
      quota: {
        limit: AI_TOKEN_QUOTA,
        used: 0,
        left: AI_TOKEN_QUOTA,
        percentUsed: 0,
        resetInHours: 24,
        period: "24h",
      },
      usage24h: { tokens: 0, calls: 0, successfulCalls: 0, successRate: 100 },
      usage30d: { tokens: 0, calls: 0 },
      providerBreakdown: {},
      featureBreakdown: {},
      latencyByProvider: {},
      recentErrors: [],
      psychObsCount: 0,
      aiConfigured: await isAIConfigured(),
      aiModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      aiProvider: "deepseek",
      rateLimits: getRateLimitStats(),
      error: e instanceof Error ? e.message : "stats unavailable",
    });
  }
}
