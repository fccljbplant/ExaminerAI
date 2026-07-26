/**
 * AI provider abstraction layer — SINGLE entry point for all AI calls.
 *
 * Provider priority:
 *   1. DeepSeek (via DEEPSEEK_API_KEY env var — primary, cost-effective)
 *      Model: deepseek-v4-flash (fast + cheap)
 *   2. Z.ai API (via ZAI_API_KEY env var or DB setting — OpenAI-compatible fallback)
 *   3. Heuristic empty response (caller handles fallback)
 *
 * DeepSeek is the primary provider because it's the most cost-effective.
 * Z.ai is kept as a fallback for when DeepSeek is not configured.
 *
 * Every successful call is logged to the `AIUsageLog` table so the admin
 * dashboard can show accurate token usage, quota remaining, and cost trends.
 */

import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { getCachedResponse, setCachedResponse } from "./token-cache";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResult {
  text: string;
  provider: "zai" | "deepseek" | "z-ai" | "fallback" | "cache";
  fallback: boolean;
  promptTokens: number;
  completionTokens: number;
  model: string;
  durationMs: number;
}

/** Centralized token budgets. */
export const TOKEN_BUDGET = {
  QUESTION_GEN: 300,
  EVALUATION: 500,
  WEEKLY_TEST_REPLY: 500,
  FINAL_ANALYSIS: 4000,
  CONNECTION_TEST: 10,
} as const;

// === Provider configuration ===

// Z.ai (primary) — OpenAI-compatible API
const ZAI_MODEL = process.env.ZAI_MODEL || "glm-4.6";
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";

// DeepSeek (primary) — OpenAI-compatible API
// User-specified base URL: https://api.deepseek.com/v1 (also works without /v1)
// Available models (per DeepSeek API /models endpoint, July 2025):
//   - deepseek-v4-flash (fast + cheap — DEFAULT)
//   - deepseek-v4-pro   (more capable, but heavy reasoning — eats tokens)
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

export const AI_TOKEN_QUOTA = Number(process.env.AI_TOKEN_QUOTA) || 2_000_000;
const RATE_LIMIT_RPM = Number(process.env.AI_RPM_LIMIT) || 60;
const RATE_LIMIT_RPD = Number(process.env.AI_RPD_LIMIT) || 10_000;

// === Key management ===

/** Check if ANY AI provider is configured. */
export function hasAI(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.ZAI_API_KEY);
}

/** Async check — true if any provider is configured via env or DB. */
export async function isAIConfigured(): Promise<boolean> {
  if (process.env.DEEPSEEK_API_KEY || process.env.ZAI_API_KEY) return true;
  const dsKey = await getAIKeyFromDB("deepseek_api_key");
  const zaiKey = await getAIKeyFromDB("zai_api_key");
  return !!(dsKey || zaiKey);
}

/** Read an API key from the DB Setting table. */
async function getAIKeyFromDB(keyName: string): Promise<string | null> {
  try {
    const { db } = await import("@/lib/db");
    const setting = await db.setting.findUnique({ where: { key: keyName } });
    return setting?.value || null;
  } catch {
    return null;
  }
}

/** Save or clear the AI API key in the DB.
 *  Stores under "zai_api_key" (primary) or "deepseek_api_key" (fallback). */
export async function setAIKey(apiKey: string | null, provider: "zai" | "deepseek" = "zai"): Promise<void> {
  const { db } = await import("@/lib/db");
  const keyName = provider === "zai" ? "zai_api_key" : "deepseek_api_key";
  if (!apiKey) {
    await db.setting.delete({ where: { key: keyName } }).catch(() => {});
    return;
  }
  await db.setting.upsert({
    where: { key: keyName },
    update: { value: apiKey },
    create: { key: keyName, value: apiKey },
  });
  // Reset cached clients
  _zaiClient = null;
  _deepseekClient = null;
  _cachedZaiKey = undefined;
  _cachedDsKey = undefined;
}

// === Client singletons ===

let _zaiClient: OpenAI | null = null;
let _deepseekClient: OpenAI | null = null;
let _cachedZaiKey: string | null | undefined = undefined;
let _cachedDsKey: string | null | undefined = undefined;

/** Get Z.ai client (primary provider). */
async function getZAIClient(): Promise<OpenAI | null> {
  // 1. Try env var
  if (process.env.ZAI_API_KEY) {
    if (!_zaiClient) {
      _zaiClient = new OpenAI({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: ZAI_BASE_URL,
      });
    }
    return _zaiClient;
  }
  // 2. Try DB setting
  if (_cachedZaiKey === undefined) {
    _cachedZaiKey = await getAIKeyFromDB("zai_api_key");
  }
  if (_cachedZaiKey) {
    if (!_zaiClient) {
      _zaiClient = new OpenAI({
        apiKey: _cachedZaiKey,
        baseURL: ZAI_BASE_URL,
      });
    }
    return _zaiClient;
  }
  return null;
}

/** Get DeepSeek client (fallback provider). */
async function getDeepSeekClient(): Promise<OpenAI | null> {
  if (process.env.DEEPSEEK_API_KEY) {
    if (!_deepseekClient) {
      _deepseekClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: DEEPSEEK_BASE_URL,
      });
    }
    return _deepseekClient;
  }
  if (_cachedDsKey === undefined) {
    _cachedDsKey = await getAIKeyFromDB("deepseek_api_key");
  }
  if (_cachedDsKey) {
    if (!_deepseekClient) {
      _deepseekClient = new OpenAI({
        apiKey: _cachedDsKey,
        baseURL: DEEPSEEK_BASE_URL,
      });
    }
    return _deepseekClient;
  }
  return null;
}

// === Token estimation ===

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// === Rate limiting ===

let _requestTimes: number[] = [];
let _dailyCount = 0;
let _dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

function trackDailyRequest() {
  const now = Date.now();
  if (now > _dailyResetAt) {
    _dailyCount = 0;
    _dailyResetAt = now + 24 * 60 * 60 * 1000;
  }
  _dailyCount++;
}

async function waitForSlot(timeoutMs: number): Promise<boolean> {
  // RPD (daily) limit check — enforced before RPM check
  if (_dailyCount >= RATE_LIMIT_RPD) {
    logger.warn("AI daily request limit reached (RPD)", { rpd: _dailyCount, limit: RATE_LIMIT_RPD });
    return false;
  }

  let now = Date.now();
  _requestTimes = _requestTimes.filter(t => now - t < 60_000);
  if (_requestTimes.length >= RATE_LIMIT_RPM) {
    const wait = _requestTimes[0] + 60_000 - now;
    if (wait > timeoutMs) return false;
    await new Promise(r => setTimeout(r, Math.min(wait, timeoutMs)));
    // Recompute `now` after sleep — the stale-timestamp bug was here
    now = Date.now();
    _requestTimes = _requestTimes.filter(t => now - t < 60_000);
  }
  _requestTimes.push(now);
  return true;
}

function isRateLimitError(e: unknown): boolean {
  if (e && typeof e === "object" && "status" in e) {
    const status = (e as { status: number }).status;
    return status === 429;
  }
  return false;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// === Usage logging ===

interface UsageLog {
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  success: boolean;
  durationMs: number;
  retriesUsed?: number;
  errorMessage?: string;
  userId?: string | null;
}

async function logUsage(log: UsageLog) {
  try {
    const { db } = await import("@/lib/db");
    await db.aIUsageLog.create({
      data: {
        userId: log.userId ?? null,
        provider: log.provider,
        model: log.model,
        feature: log.feature,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        success: log.success,
        durationMs: log.durationMs,
        errorMessage: log.errorMessage,
      },
    });
  } catch { /* best-effort */ }
}

// === Main entry point ===

/** Call AI with the best available provider.
 *  Priority: DeepSeek (primary, cost-effective) → Z.ai (fallback) → empty fallback
 *
 *  Options:
 *  - temperature: 0-2 (default 0.5)
 *  - maxTokens:   response token cap (default QUESTION_GEN = 300)
 *  - feature:     label for usage logging (e.g. "weekly-test-reply")
 *  - cacheable:   if true, check token-cache before calling the provider.
 *                 On a hit, return the cached response instantly (no API call).
 *                 On a miss, store the successful response for reuse.
 *                 Only use for calls where the same input recurs — NEVER
 *                 for per-student conversations or grading.
 *  - cacheTtlMs:  cache TTL in ms (default 1 hour). Only used if cacheable.
 */
export async function callAI(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    feature?: string;
    cacheable?: boolean;
    cacheTtlMs?: number;
    userId?: string; // for per-user daily rate limiting + usage attribution
  }
): Promise<AIResult> {
  const temp = options?.temperature ?? 0.5;
  const maxTokens = options?.maxTokens ?? TOKEN_BUDGET.QUESTION_GEN;
  const feature = options?.feature ?? "unknown";
  const startedAt = Date.now();

  // ---- 0. Token cache check (opt-in via `cacheable: true`) ----
  // Caches the FULL message array (including system prompt + user messages)
  // so the same input skips the provider call entirely. Hit rate is highest
  // for system-prompt-heavy calls with stable inputs (AI Tutor, question gen).
  if (options?.cacheable) {
    const cached = getCachedResponse(
      messages.map(m => ({ role: m.role, content: m.content })),
      { temperature: temp, maxTokens },
    );
    if (cached) {
      // Return a synthetic AIResult — no API call, no usage log (we didn't
      // bill anything). Mark as fallback:false (real response, just cached).
      return {
        text: cached.text,
        provider: "cache", // cached response — no provider was called
        fallback: false,
        promptTokens: cached.promptTokens,
        completionTokens: cached.completionTokens,
        model: cached.model,
        durationMs: Date.now() - startedAt, // typically <1ms
      };
    }
  }

  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  /** Helper: store a successful result in the token cache if `cacheable` was set. */
  const maybeCache = (text: string, promptTokens: number, completionTokens: number, model: string) => {
    if (options?.cacheable) {
      setCachedResponse(
        messages.map(m => ({ role: m.role, content: m.content })),
        { temperature: temp, maxTokens },
        { text, promptTokens, completionTokens, model },
        options.cacheTtlMs ? { ttlMs: options.cacheTtlMs } : undefined,
      );
    }
  };

  // ---- 1. Try DeepSeek API (primary — cost-effective) ----
  const dsClient = await getDeepSeekClient();
  if (dsClient) {
    const gotSlot = await waitForSlot(10_000);
    if (gotSlot) {
      try {
        const completion = await dsClient.chat.completions.create({
          model: DEEPSEEK_MODEL,
          messages: apiMessages,
          temperature: temp,
          max_tokens: maxTokens,
        }) as any; // any-typed: DeepSeek V4 returns `reasoning_content` not in OpenAI type
        trackDailyRequest();
        // DeepSeek V4 reasoning models sometimes return content in
        // `reasoning_content` instead of `content` (especially when
        // max_tokens is tight — all tokens get spent on reasoning).
        // Prefer `content`; fall back to `reasoning_content` if empty.
        const msg = completion.choices?.[0]?.message;
        const rawText = (msg?.content ?? "").toString().trim();
        const reasoningText = (msg?.reasoning_content ?? "").toString().trim();
        const text = rawText || reasoningText;
        if (text) {
          const promptTokens = completion.usage?.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join(""));
          const completionTokens = completion.usage?.completion_tokens ?? estimateTokens(text);
          logUsage({
            provider: "deepseek", model: DEEPSEEK_MODEL, feature,
            promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
            success: true, durationMs: Date.now() - startedAt,
            userId: options?.userId,
          }).catch(() => {});
          maybeCache(text, promptTokens, completionTokens, DEEPSEEK_MODEL);
          return { text, provider: "deepseek", fallback: false, promptTokens, completionTokens, model: DEEPSEEK_MODEL, durationMs: Date.now() - startedAt };
        } else {
          logger.warn("DeepSeek returned empty content AND reasoning_content", {
            feature, model: DEEPSEEK_MODEL,
            finish_reason: completion.choices?.[0]?.finish_reason,
            usage: completion.usage,
          });
        }
      } catch (e) {
        logger.error("DeepSeek API failed, trying Z.ai", { feature, error: e instanceof Error ? e.message : String(e) });
        logUsage({
          provider: "deepseek", model: DEEPSEEK_MODEL, feature,
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          success: false, durationMs: Date.now() - startedAt,
          errorMessage: e instanceof Error ? e.message : String(e),
          userId: options?.userId,
        }).catch(() => {});
      }
    }
  }

  // ---- 2. Try Z.ai API (fallback) ----
  const zaiClient = await getZAIClient();
  if (zaiClient) {
    const gotSlot = await waitForSlot(10_000);
    if (gotSlot) {
    try {
      const completion = await zaiClient.chat.completions.create({
        model: ZAI_MODEL,
        messages: apiMessages,
        temperature: temp,
        max_tokens: maxTokens,
      });
      trackDailyRequest();
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) {
        const promptTokens = completion.usage?.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join(""));
        const completionTokens = completion.usage?.completion_tokens ?? estimateTokens(text);
        logUsage({
          provider: "zai", model: ZAI_MODEL, feature,
          promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
          success: true, durationMs: Date.now() - startedAt,
          userId: options?.userId,
        }).catch(() => {});
        maybeCache(text, promptTokens, completionTokens, ZAI_MODEL);
        return { text, provider: "zai", fallback: false, promptTokens, completionTokens, model: ZAI_MODEL, durationMs: Date.now() - startedAt };
      }
    } catch (e) {
      logger.error("Z.ai failed, returning empty fallback", { feature, error: e instanceof Error ? e.message : String(e) });
    }
    } // end gotSlot
  }

  // ---- 3. Empty fallback ----
  logger.warn("All AI providers failed — returning empty", { feature });
  return {
    text: "",
    provider: "fallback",
    fallback: true,
    promptTokens: 0,
    completionTokens: 0,
    model: "none",
    durationMs: Date.now() - startedAt,
  };
}

// === Admin helpers ===

/** Get daily request count for dashboard display. */
export function getDailyRequestCount(): number {
  const now = Date.now();
  if (now > _dailyResetAt) return 0;
  return _dailyCount;
}

/** Get recent request timestamps for rate-limit display. */
export function getRecentRequestCount(): number {
  const now = Date.now();
  _requestTimes = _requestTimes.filter(t => now - t < 60_000);
  return _requestTimes.length;
}

/** Get rate limit stats for the admin dashboard. */
export function getRateLimitStats() {
  return {
    rpm: getRecentRequestCount(),
    rpmLimit: RATE_LIMIT_RPM,
    rpd: getDailyRequestCount(),
    rpdLimit: RATE_LIMIT_RPD,
    remaining: Math.max(0, RATE_LIMIT_RPD - getDailyRequestCount()),
  };
}

// ============================================================
// Behavioral signal translation — used by /api/ai/evaluate
// ============================================================

/** Translate raw behavioral signals into plain-English insights.
 *  Returns an array of insight strings (possibly empty). */
export function translateBehavioralSignals(
  cognitiveLoad: string,
  confidence: string,
  metacognitive: string,
  correctness: number
): string[] {
  const insights: string[] = [];

  // Cognitive load — how hard the material is for this student
  if (cognitiveLoad === "high" && correctness < 60) {
    insights.push("This topic is stretching you right now — that's normal for something new. Take it one step at a time.");
  }
  if (cognitiveLoad === "low" && correctness >= 80) {
    insights.push("You're comfortable with this material. Try explaining it to a peer — teaching is the best way to deepen understanding.");
  }

  // Confidence vs correctness (calibration) — does the student know what they know?
  if (confidence === "high" && correctness < 60) {
    insights.push("You were more sure than the answer was right — double-check your reasoning before committing to an answer.");
  }
  if (confidence === "low" && correctness >= 80) {
    insights.push("You know this — trust your first instinct. Your answers are better than your confidence suggests.");
  }
  if (confidence === "low" && correctness < 50) {
    insights.push("Your uncertainty makes sense here — let's review this concept together and build from the basics.");
  }

  // Metacognitive awareness — does the student think about their own thinking?
  if (metacognitive === "low") {
    insights.push("Try explaining this out loud before answering — hearing yourself think helps catch gaps in reasoning.");
  }
  if (metacognitive === "high") {
    insights.push("Strong self-awareness — you think about your own thinking, which is the foundation of deep learning.");
  }

  return insights;
}

/** Get a teacher-facing label for confidence vs ability mismatch.
 *  Used in the student portfolio for calibration display. */
export function getConfidenceMismatchLabel(
  confidence: "low" | "moderate" | "high",
  correctness: number
): string {
  if (confidence === "high" && correctness < 60) {
    return "Overconfident — doesn't know what they don't know";
  }
  if (confidence === "low" && correctness >= 80) {
    return "Underconfident — knows more than they think";
  }
  if (confidence === "low" && correctness < 50) {
    return "Appropriately uncertain — needs support";
  }
  return "Calibrated — confidence matches ability";
}
