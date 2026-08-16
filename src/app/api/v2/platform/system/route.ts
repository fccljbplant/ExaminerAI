/**
 * GET /api/v2/platform/system — P3 System panel (V1 SystemPanel re-homed,
 * W10 audit)
 *
 * Live health checks (db / ai / jwt — same probes as /api/health),
 * registered cron routes, and a cache purge action.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { clearTokenCache, getCacheStats } from "@/modules/assessment/lib/token-cache";
import { clearNamespace, getCacheOverview } from "@/modules/ai";

export const runtime = "nodejs";

const CRONS = [
  { path: "/api/cron/srs-due", schedule: "0 3 * * *", label: "SRS due cards" },
  { path: "/api/cron/study-plan-refresh", schedule: "0 6 * * *", label: "Study plan refresh" },
  { path: "/api/cron/absence-scan", schedule: "0 7 * * *", label: "Absence scan" },
  { path: "/api/cron/compliance-expiry", schedule: "0 4 * * *", label: "Compliance expiry + nudges" },
  { path: "/api/cron/trials-expiry", schedule: "0 8 * * *", label: "Org trial expiry" },
  { path: "/api/cron/billing-dunning", schedule: "0 9 * * *", label: "Billing dunning" },
  { path: "/api/cron/payouts-sweep", schedule: "0 5 1 * *", label: "Monthly payout sweep" },
  { path: "/api/cron/ai-budget-alerts", schedule: "0 * * * *", label: "AI budget threshold alerts" },
  { path: "/api/cron/audit-retention", schedule: "0 10 * * 0", label: "Audit log retention" },
];

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const checks = { db: false, ai: false, jwt: false };
  try {
    await db.user.count({ take: 1 });
    checks.db = true;
  } catch {
    /* db down */
  }
  try {
    // Same semantics as /api/health but with the dev fallback respected:
    // in development the built-in default secret IS the working config
    // (the request running this very check is JWT-authenticated). Only
    // production requires a real, non-default JWT_SECRET.
    await import("@/lib/auth");
    const isProd =
      process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV);
    checks.jwt = isProd
      ? Boolean(process.env.JWT_SECRET) &&
        process.env.JWT_SECRET !== "examiner-ai-dev-secret-change-me"
      : true;
  } catch {
    /* jwt lib unavailable */
  }
  // AI is considered reachable when the provider chain is configured.
  try {
    const { isAIConfigured } = await import("@/modules/assessment/lib/ai-provider");
    checks.ai = await isAIConfigured();
  } catch {
    /* provider check unavailable */
  }

  const health = Object.values(checks).every(Boolean) ? "ok" : "degraded";

  // Environment allowlist — names only, never values (W16: V1
  // SystemPanel env-status restored without leaking secrets). Z.ai is
  // the PRIMARY provider; DeepSeek is the fallback — surface both.
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
    ZAI_API_KEY: Boolean(process.env.ZAI_API_KEY),
    ZAI_BASE_URL: Boolean(process.env.ZAI_BASE_URL),
    DEEPSEEK_API_KEY: Boolean(process.env.DEEPSEEK_API_KEY),
    DEEPSEEK_BASE_URL: Boolean(process.env.DEEPSEEK_BASE_URL),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  };

  return apiSuccess({
    health,
    checks,
    env,
    crons: CRONS,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "purge-cache") {
    // Real purge (2026-08-17): clear the in-memory token cache and every
    // DB-backed AI context-cache namespace (course-gen, tutor-topic,
    // learner, cohort, project, course-outline). Previously this was a
    // fake success — operators got confirmation but nothing happened.
    const namespaces = await getCacheOverview();
    let dbRows = 0;
    for (const ns of namespaces) {
      dbRows += await clearNamespace(ns.namespace).catch(() => 0);
    }
    const memoryEntries = getCacheStats().size;
    clearTokenCache();
    return apiSuccess({ purged: true, dbRows, memoryEntries, namespaces: namespaces.length });
  }

  return apiError("Unknown action", "VALIDATION_ERROR", 400);
}
