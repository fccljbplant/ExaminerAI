/**
 * AI Rate Limits — per-user, per-feature-category, daily.
 *
 * Three categories with admin-configurable limits:
 *   - test      (default 50/day)  — practice, daily-test, weekly-test, evaluate, question-gen
 *   - tutor     (default 150/day) — ai-tutor
 *   - assistant (default 100/day) — teacher_assistant, action-dialog, escalation, debug-ping
 *
 * Counts are derived from AIUsageLog rows for the current UTC day.
 * Limits are read from the Setting table (admin-configurable).
 *
 * Demo accounts: optionally disabled entirely via `demo_ai_enabled` setting.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AICategory = "test" | "tutor" | "assistant";

export interface RateLimitResult {
  allowed: boolean;
  category: AICategory;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date; // when the daily window resets (next UTC midnight)
}

const DEFAULT_LIMITS: Record<AICategory, number> = {
  test: 50,
  tutor: 150,
  assistant: 100,
};

const SETTING_KEYS: Record<AICategory, string> = {
  test: "ai_test_daily_limit",
  tutor: "ai_tutor_daily_limit",
  assistant: "ai_assistant_daily_limit",
};

/** Map raw AIUsageLog.feature values to one of the 3 categories. */
const FEATURE_TO_CATEGORY: Record<string, AICategory> = {
  // Test category — all assessment/test chatbot features
  "question-gen": "test",
  "evaluate": "test",
  "practice": "test",
  "practice-start": "test",
  "practice-reply": "test",
  "daily-test": "test",
  "daily-test-reply": "test",
  "weekly-test": "test",
  "weekly-test-start": "test",
  "weekly-test-reply": "test",
  "weekly-test-final-analysis": "test",
  "final-analysis": "test",
  "final-result": "test",
  "project-report": "test",
  "project-report-analysis": "test",
  "project-tasks": "test",
  "project-task-gen": "test",
  "project-week-gen": "test",
  "project-final-analysis": "test",
  "project-summary-gen": "test",
  "course-gen": "test",
  "course-gen-batch": "test",
  "connection-test": "test",
  // Tutor category — student-facing AI Tutor only
  "ai-tutor": "tutor",
  "instructor-tutor": "tutor", // teacher-facing tutor (uses same category)
  // Assistant category — staff-facing AI Assistant + student-detail tools
  "teacher_assistant": "assistant",
  "action-dialog": "assistant",
  "action_dialog": "assistant", // legacy typo — still counted
  "escalation": "assistant",
  "debug-ping": "assistant",
  "daily-motivation": "assistant",
  // Student-detail AI tools (teacher viewing student portfolio)
  "student-explain": "assistant",
  "narrative-week": "assistant",
  "draft-checkin": "assistant",
  "rehearse-reply": "assistant",
  "rehearse-start": "assistant",
  "comprehensive-report": "assistant",
  // Mentorship AI tools
  "case-review-anonymize": "assistant",
  "touchpoint-parse": "assistant",
  "topic-guidance": "assistant",
};

/** Get the category for a feature label. Returns "assistant" as fallback. */
export function categoryForFeature(feature: string): AICategory {
  return FEATURE_TO_CATEGORY[feature] || "assistant";
}

/** Get the configured daily limit for a category (admin-configurable). */
export async function getCategoryLimit(category: AICategory): Promise<number> {
  try {
    const setting = await db.setting.findUnique({ where: { key: SETTING_KEYS[category] } });
    if (setting) {
      const parsed = parseInt(setting.value, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch { /* fall through to default */ }
  return DEFAULT_LIMITS[category];
}

/** Check if demo accounts can use AI at all (admin-configurable). */
export async function isDemoAIEnabled(): Promise<boolean> {
  try {
    const setting = await db.setting.findUnique({ where: { key: "demo_ai_enabled" } });
    return setting ? setting.value === "true" : true; // default: enabled
  } catch {
    return true;
  }
}

/** Get the start of the current UTC day (00:00:00 UTC). */
function startOfUTCDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Get the end of the current UTC day (next 00:00:00 UTC). */
function endOfUTCDay(): Date {
  const start = startOfUTCDay();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Count today's AIUsageLog rows for a user + category.
 *  Maps all feature values in the category and counts matching rows. */
async function countTodayUsage(userId: string, category: AICategory): Promise<number> {
  const start = startOfUTCDay();
  const end = endOfUTCDay();

  // Get all feature labels that map to this category
  const featuresInCategory = Object.entries(FEATURE_TO_CATEGORY)
    .filter(([, cat]) => cat === category)
    .map(([feat]) => feat);

  try {
    return await db.aIUsageLog.count({
      where: {
        userId,
        feature: { in: featuresInCategory },
        createdAt: { gte: start, lt: end },
        success: true, // only count successful calls against the limit
      },
    });
  } catch (err) {
    logger.warn("Failed to count AI usage", { userId, category, error: err instanceof Error ? err.message : String(err) });
    return 0; // fail-open: if we can't count, allow the call
  }
}

/** Check if a user can make an AI call in this category.
 *  Returns the rate-limit decision (allowed + remaining + reset time). */
export async function checkUserAILimit(
  userId: string,
  category: AICategory,
): Promise<RateLimitResult> {
  const [limit, used] = await Promise.all([
    getCategoryLimit(category),
    countTodayUsage(userId, category),
  ]);

  return {
    allowed: used < limit,
    category,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: endOfUTCDay(),
  };
}

/** Check if a demo user can use AI at all. Returns true if blocked. */
export async function isDemoAIBlocked(isDemo: boolean): Promise<boolean> {
  if (!isDemo) return false;
  const enabled = await isDemoAIEnabled();
  return !enabled;
}

/**
 * H1 fix (audit 2026-07-26): unified rate-limit + demo-block check.
 *
 * Returns `null` if the call is allowed, or an error response object that
 * the route can return directly. Usage:
 *
 *   const blocked = await enforceAIRateLimit(userId, feature, isDemo);
 *   if (blocked) return blocked;
 *
 * This wraps the isDemoAIBlocked + checkUserAILimit pattern so the 16 AI
 * routes that were missing rate limiting can add it in 3 lines instead of 15.
 *
 * @param userId  The user making the AI call (for per-user daily limit).
 * @param feature The feature label (e.g. "daily-motivation", "course-gen").
 *                Mapped to a category via categoryForFeature().
 * @param isDemo  Whether the user is the demo account (demo can be blocked entirely).
 * @returns null if allowed, or a NextResponse-shaped object if blocked.
 */
/** Features whose per-user daily AI limit does not apply — they are
 *  single heavy generations (courses, project timelines) rather than
 *  chat-style calls, and blocking them mid-session bricks the tools. */
export const AI_LIMIT_EXEMPT_FEATURES = new Set([
  "course-gen",
  "course-gen-batch",
  "course-outline",
  "project-summary-gen",
  "project-plan",
  "project-task-gen",
  "project-timeline",
  "project-suggestions",
]);

export async function enforceAIRateLimit(
  userId: string,
  feature: string,
  isDemo: boolean = false,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  // 1. Demo block check
  if (await isDemoAIBlocked(isDemo)) {
    return {
      status: 403,
      body: { error: "AI access for demo accounts is currently disabled by the administrator." },
    };
  }
  // 2. Per-user daily rate limit — GENERATION features are exempt
  // (2026-08-15): course generation and project/timeline generation
  // need thousands of tokens per call; capping them by call-count made
  // the tools unusable. They are still rate-limited by the middleware's
  // global AI RPM guard and still logged per call.
  if (AI_LIMIT_EXEMPT_FEATURES.has(feature)) {
    return null;
  }
  const category = categoryForFeature(feature);
  const limit = await checkUserAILimit(userId, category);
  if (!limit.allowed) {
    return {
      status: 429,
      body: {
        error: `Daily AI limit reached for ${category} (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
        rateLimited: true,
        category,
        used: limit.used,
        limit: limit.limit,
        resetAt: limit.resetAt.toISOString(),
      },
    };
  }
  return null;
}
