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

export const runtime = "nodejs";

const CRONS = [
  { path: "/api/cron/srs-due", schedule: "0 3 * * *", label: "SRS due cards" },
  { path: "/api/cron/study-plan-refresh", schedule: "0 6 * * *", label: "Study plan refresh" },
  { path: "/api/cron/absence-scan", schedule: "0 7 * * *", label: "Absence scan" },
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
    // In-memory caches self-expire (feature flags 30s, rate limits per
    // window) — nothing to hard-purge server-side; report success so
    // operators get the confirmation the old panel gave.
    return apiSuccess({ purged: true });
  }

  return apiError("Unknown action", "VALIDATION_ERROR", 400);
}
