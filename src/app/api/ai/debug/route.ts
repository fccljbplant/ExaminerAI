import { NextResponse } from "next/server";
import { requireRole, UserRole } from "@/lib/rbac";
import { callAI, hasAI, isAIConfigured } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * GET /api/ai/debug — diagnostic endpoint that verifies the AI provider chain.
 *
 * Admin-only (any admin role). Returns a structured report showing:
 *   - Whether each provider env var is set
 *   - Which provider was actually used
 *   - The actual API response (or error message)
 *   - Timing + token usage
 *
 * This is the fastest way to debug "AI not working" issues on Vercel.
 */

export async function GET() {
  const auth = await requireRole([
    UserRole.ADMINISTRATOR, UserRole.PRINCIPAL, UserRole.DEMO,
  ]);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercelRegion: process.env.VERCEL_REGION || "local",
  };

  // 1. Feature flag
  try {
    report.aiEnabled = await isFeatureEnabled("ai_enabled");
  } catch (e) {
    report.aiEnabled = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. Env var presence (C9 fix: do NOT expose API key prefix/suffix — even
  //    partial key leaks make it easier to brute-force the rest. Just report
  //    "set" vs "NOT SET" and the key LENGTH for sanity-check, no characters.)
  report.envVars = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? `set (length: ${process.env.DEEPSEEK_API_KEY.length})` : "NOT SET",
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "(default: deepseek-v4-flash)",
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || "(default: https://api.deepseek.com/v1)",
    ZAI_API_KEY: process.env.ZAI_API_KEY ? `set (length: ${process.env.ZAI_API_KEY.length})` : "NOT SET",
    ZAI_MODEL: process.env.ZAI_MODEL || "(default: glm-4.6)",
    ZAI_BASE_URL: process.env.ZAI_BASE_URL || "(default: https://api.z.ai/api/paas/v4)",
  };

  // 3. isAIConfigured (checks env + DB)
  try {
    report.isAIConfigured = await isAIConfigured();
    report.hasAI = hasAI();
  } catch (e) {
    report.isAIConfigured = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. Ping each provider directly to isolate failures
  const providerResults: Record<string, unknown> = {};

  // --- Test DeepSeek directly ---
  if (process.env.DEEPSEEK_API_KEY) {
    const dsStart = Date.now();
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
          messages: [
            { role: "system", content: "Reply with exactly: PONG" },
            { role: "user", content: "ping" },
          ],
          max_tokens: 30,
          temperature: 0,
        }),
      });
      const dsElapsed = Date.now() - dsStart;
      const dsStatus = res.status;
      const dsBody = await res.text();
      let dsParsed: any = null;
      try { dsParsed = JSON.parse(dsBody); } catch {}
      providerResults.deepseek = {
        elapsedMs: dsElapsed,
        httpStatus: dsStatus,
        success: dsStatus === 200 && !!(dsParsed?.choices?.[0]?.message?.content || dsParsed?.choices?.[0]?.message?.reasoning_content),
        content: dsParsed?.choices?.[0]?.message?.content || "",
        reasoningContent: dsParsed?.choices?.[0]?.message?.reasoning_content || "",
        finishReason: dsParsed?.choices?.[0]?.finish_reason,
        usage: dsParsed?.usage,
        error: dsParsed?.error?.message || (dsStatus !== 200 ? dsBody.slice(0, 200) : null),
        model: dsParsed?.model,
      };
    } catch (e) {
      providerResults.deepseek = {
        elapsedMs: Date.now() - dsStart,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } else {
    providerResults.deepseek = { skipped: "DEEPSEEK_API_KEY not set" };
  }

  // --- Test Z.ai directly ---
  if (process.env.ZAI_API_KEY) {
    const zaiStart = Date.now();
    try {
      const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.ZAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.ZAI_MODEL || "glm-4.6",
          messages: [
            { role: "system", content: "Reply with exactly: PONG" },
            { role: "user", content: "ping" },
          ],
          max_tokens: 30,
          temperature: 0,
        }),
      });
      const zaiElapsed = Date.now() - zaiStart;
      const zaiStatus = res.status;
      const zaiBody = await res.text();
      let zaiParsed: any = null;
      try { zaiParsed = JSON.parse(zaiBody); } catch {}
      providerResults.zai = {
        elapsedMs: zaiElapsed,
        httpStatus: zaiStatus,
        success: zaiStatus === 200 && !!zaiParsed?.choices?.[0]?.message?.content,
        content: zaiParsed?.choices?.[0]?.message?.content || "",
        error: zaiParsed?.error?.message || (zaiStatus !== 200 ? zaiBody.slice(0, 200) : null),
        model: zaiParsed?.model,
      };
    } catch (e) {
      providerResults.zai = {
        elapsedMs: Date.now() - zaiStart,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } else {
    providerResults.zai = { skipped: "ZAI_API_KEY not set" };
  }

  report.providers = providerResults;

  // 5. Test the callAI() entry point end-to-end
  const callStart = Date.now();
  try {
    const result = await callAI([
      { role: "system", content: "Reply with exactly: PONG" },
      { role: "user", content: "ping" },
    ], {
      temperature: 0,
      maxTokens: 30,
      feature: "debug-ping",
    });
    report.callAI = {
      elapsedMs: Date.now() - callStart,
      provider: result.provider,
      fallback: result.fallback,
      model: result.model,
      text: result.text,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      success: !!result.text && !result.fallback,
    };
  } catch (e) {
    report.callAI = {
      elapsedMs: Date.now() - callStart,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 6. Recent AI usage logs from DB (last 10 calls)
  try {
    const { db } = await import("@/lib/db");
    const recent = await db.aIUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        provider: true, model: true, feature: true, success: true,
        errorMessage: true, durationMs: true,
        promptTokens: true, completionTokens: true,
        createdAt: true,
      },
    });
    report.recentLogs = recent;
  } catch (e) {
    report.recentLogs = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  report.totalElapsedMs = Date.now() - startedAt;

  logger.info("AI debug report generated", {
    feature: "ai-debug",
    callAISuccess: (report.callAI as any)?.success,
  });

  return NextResponse.json(report, { status: 200 });
}
