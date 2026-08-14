/**
 * GET /api/v2/platform/ai — P4 AI panel (V1 AILimitsPanel/AIConnectionPanel
 * re-homed, W10 audit)
 *
 * AI usage aggregate from AIUsageLog: totals by provider and feature,
 * token consumption, request counts, and recent activity.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const [rows, byProvider, byFeature, total] = await Promise.all([
    db.aIUsageLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.aIUsageLog.groupBy({
      by: ["provider"],
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { _all: true },
    }),
    db.aIUsageLog.groupBy({
      by: ["feature"],
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    db.aIUsageLog.aggregate({
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
  ]);

  return apiSuccess({
    totals: {
      requests: total._count._all,
      tokens: total._sum.totalTokens ?? 0,
    },
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      requests: p._count._all,
      tokens: p._sum.totalTokens ?? 0,
      promptTokens: p._sum.promptTokens ?? 0,
      completionTokens: p._sum.completionTokens ?? 0,
    })),
    byFeature: byFeature
      .map((f) => ({ feature: f.feature, requests: f._count._all, tokens: f._sum.totalTokens ?? 0 }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 12),
    recent: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      feature: r.feature,
      tokens: r.totalTokens,
      at: r.createdAt.toISOString(),
    })),
  });
}
