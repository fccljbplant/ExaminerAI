import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { callAI, hasAI, isAIConfigured, TOKEN_BUDGET } from "@/lib/ai-provider";
import { connectionTestPrompt } from "@/lib/ai-prompts";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** POST /api/ai/test — admin-only diagnostic endpoint that runs a real AI
 *  call and returns the result + timing + provider used.
 *
 *  Uses minimal tokens (10 max output) to avoid wasting quota.
 *
 *  Body:
 *    - apiKey (optional) — a DeepSeek API key to test inline
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const inlineApiKey = (body.apiKey as string | undefined)?.trim();

  // SECURITY FIX: Never mutate process.env — use a local client instead.
  // The old code did `process.env.DEEPSEEK_API_KEY = inlineApiKey` which
  // poisoned the cached client for ALL subsequent requests by ALL users.
  if (inlineApiKey) {
    // Test with a one-off client — doesn't affect the global AI provider
    const { default: OpenAI } = await import("openai");
    const testClient = new OpenAI({
      apiKey: inlineApiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    });
    const startedAt = Date.now();
    try {
      const completion = await testClient.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: connectionTestPrompt() }],
        temperature: 0,
        max_tokens: 10,
      });
      return NextResponse.json({
        ok: true,
        provider: "deepseek (inline key)",
        response: completion.choices[0]?.message?.content || "(empty response)",
        durationMs: Date.now() - startedAt,
        tokens: { prompt: completion.usage?.prompt_tokens || 0, completion: completion.usage?.completion_tokens || 0 },
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : "Inline key test failed",
        durationMs: Date.now() - startedAt,
      }, { status: 200 });
    }
  }

  const startedAt = Date.now();
  const aiConfigured = await isAIConfigured();

  try {
    const result = await callAI([
      { role: "user", content: connectionTestPrompt() },
    ], { temperature: 0, maxTokens: TOKEN_BUDGET.CONNECTION_TEST, feature: "connection-test" });

    return NextResponse.json({
      ok: !result.fallback,
      provider: result.provider,
      response: result.text || "(empty response)",
      durationMs: Date.now() - startedAt,
      tokens: {
        prompt: result.promptTokens,
        completion: result.completionTokens,
        total: result.promptTokens + result.completionTokens,
      },
      aiConfigured,
      envAIConfigured: hasAI(),
      model: result.model,
      fallback: result.fallback,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      provider: "error",
      response: "",
      durationMs: Date.now() - startedAt,
      tokens: { prompt: 0, completion: 0, total: 0 },
      aiConfigured,
      envAIConfigured: hasAI(),
      error: e instanceof Error ? e.message : "Unknown error",
    }, { status: 500 });
  }
}
