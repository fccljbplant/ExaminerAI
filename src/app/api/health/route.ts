import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";

/** GET /api/health — lightweight health check for Vercel monitoring + uptime checks.
 *
 *  Returns 200 if the app is healthy, 503 if any critical dependency is down.
 *  No auth required — this is a public endpoint designed for monitoring tools
 *  (Vercel cron, UptimeRobot, BetterStack, etc.).
 *
 *  Checks:
 *  1. Database connectivity (can we reach Prisma?)
 *  2. AI provider configured (env var or DB setting)
 *  3. JWT secret set (security check)
 *
 *  Response:
 *    {
 *      status: "ok" | "degraded" | "down",
 *      checks: { db: bool, ai: bool, jwt: bool },
 *      timestamp: ISO string,
 *      version: string
 *    }
 */
export async function GET() {
  const checks = {
    db: false,
    ai: false,
    jwt: false,
  };

  // 1. Database — try a simple count query with a 3s timeout
  try {
    await Promise.race([
      db.user.count({ take: 1 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 3000)
      ),
    ]);
    checks.db = true;
  } catch (e) {
    logger.error("Health check: DB failed", { error: e instanceof Error ? e.message : "unknown" });
  }

  // 2. AI provider — check if DeepSeek key is configured
  checks.ai = hasAI();

  // 3. JWT secret — check if it's set (not the dev default)
  checks.jwt = process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET !== "examiner-ai-dev-secret-change-me";

  // Overall status
  const status = checks.db
    ? (checks.ai && checks.jwt ? "ok" : "degraded")
    : "down";

  const httpStatus = status === "down" ? 503 : 200;

  return NextResponse.json({
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  }, { status: httpStatus });
}
