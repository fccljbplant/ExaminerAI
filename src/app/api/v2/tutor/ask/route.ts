import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { streamAI } from "@/modules/assessment/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature, isOrgOverBudget } from "@/lib/ai-rate-limits";
import { apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getTutorContext } from "@/modules/learn/lib/study-flow-db";
import {
  universalTutorSystemPrompt,
  buildTutorContextMessage,
  tutorQuestionPrefix,
} from "@/modules/ai";
import type { TutorContextResult } from "@/modules/learn/lib/study-flow";

/**
 * POST /api/v2/tutor/ask — floating-tutor chat (REDESIGN-P4, W2)
 *
 * v2 replacement for the legacy /api/ai/tutor/stream, built for the
 * modules/tutor FloatingTutor:
 *
 *  - context comes from the learner's ACTUAL enrollment (LearnProfile
 *    + current topic via masteryMap), not legacy User fields;
 *  - `surface` (the portal route the learner is on) rides along so the
 *    prompt can reference where the question was asked;
 *  - W3: the study-flow scenario packet (`getTutorContext`) is merged in
 *    so the tutor knows about absences, cramming and exam proximity and
 *    can proactively offer the matching scenario options;
 *  - TEXT-ONLY contract (P2 §1.5): the system prompt tells the model
 *    it reads text only and must never claim to see files or media.
 *
 * Request:  { messages: [{role, content}], surface?: string }
 * Response: text/event-stream of plain-text chunks; may emit
 *           `[stream-degraded: <reason>]` on provider failure.
 */

export const runtime = "nodejs"; // streaming needs Node, not Edge

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function POST(req: NextRequest) {
  const demoBlock = await demoWriteBlock("running AI operations");
  if (demoBlock) return demoBlock;

  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!LEARNER_ROLES.has(user.role)) {
    return NextResponse.json({ error: "The tutor is available to learner accounts." }, { status: 403 });
  }

  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json(
      { error: "AI access for demo accounts is currently disabled by the administrator." },
      { status: 403 }
    );
  }

  const category = categoryForFeature("ai-tutor");
  const limit = await checkUserAILimit(user.sub, category);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Daily AI Tutor limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
        rateLimited: true,
        category,
        used: limit.used,
        limit: limit.limit,
        resetAt: limit.resetAt.toISOString(),
      },
      { status: 429 }
    );
  }

  // Per-org AI budget (2026-08-16): the tutor is the single
  // highest-volume AI surface, so org budgets are enforced here via the
  // learner's org membership. Other AI surfaces follow the same pattern.
  const membership = await db.orgMember
    .findFirst({
      where: { userId: user.sub, status: { not: "removed" } },
      select: { orgId: true },
    })
    .catch(() => null);
  const orgId = membership?.orgId ?? null;
  if (orgId) {
    const budget = await isOrgOverBudget(orgId);
    if (budget.over) {
      return apiError("Your organization's AI budget is exhausted", "RATE_LIMITED", 429);
    }
  }

  const body = await req.json().catch(() => ({}));
  const { messages, surface } = body as {
    messages?: { role: "user" | "assistant"; content: string }[];
    surface?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }
  if (messages.length > 50) {
    return NextResponse.json({ error: "Too many messages (max 50)" }, { status: 400 });
  }
  for (const m of messages) {
    if (typeof m.content !== "string" || m.content.length > 8000) {
      return NextResponse.json(
        { error: "Message too long (max 8000 characters per message)" },
        { status: 400 }
      );
    }
  }

  const context = await buildContext(user.sub);

  // Universal subject-agnostic tutor (2026-08-15): the SYSTEM prompt is
  // static and cacheable; the COURSE OUTLINE / CURRENT TOPIC / STUDENT
  // PROJECT / STUDENT DATA block is assembled from the per-subject packs
  // (encrypted at rest, anonymized) into ONE stable context message, so
  // system + context form a long cacheable prefix — only the final
  // "Student asks: …" message varies per turn.
  const studyFlow = context.courseId
    ? await getTutorContext(user.sub, context.courseId, surface ?? "").catch(() => null)
    : null;
  const scenarioBlock =
    studyFlow && studyFlow.activeScenario !== "normal"
      ? [
          `STUDY-FLOW: ${studyFlow.contextSummary}`,
          `ACTIVE SCENARIO: ${studyFlow.activeScenario}`,
          studyFlow.proactiveOffer
            ? `PROACTIVE OFFER (mention at most once, only if it fits naturally, never nag): "${studyFlow.proactiveOffer.copy}" Options you may suggest: ${studyFlow.proactiveOffer.options.map((o) => o.label).join(" / ")}.`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const contextMessage = await buildTutorContextMessage({
    userId: user.sub,
    courseId: context.courseId,
    topic: context.topic ? { week: context.topic.week, day: context.topic.day } : null,
    studyFlow: scenarioBlock || undefined,
  }).catch(() => "");

  const questionPrefix = tutorQuestionPrefix(context.topic?.title, null);
  const systemPrompt = universalTutorSystemPrompt({ surface });

  try {
    const stream = await streamAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextMessage || "The learner is not enrolled yet." },
        ...messages.map((m) => ({
          role: m.role,
          content: m.role === "user" ? `${questionPrefix}${m.content}` : m.content,
        })),
      ],
      { temperature: 0.7, maxTokens: 600, feature: "ai-tutor-v2", userId: user.sub, orgId: orgId ?? undefined }
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    logger.error("v2 tutor stream init failed", {
      feature: "ai-tutor-v2",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "AI Tutor is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}

/* ---- context building (P4 tutorContext seed) ---------------------- */

interface TutorContextLite {
  courseId: string | null;
  courseName: string | null;
  courseDomain: string | null;
  courseLevel: string | null;
  totalXP: number;
  streak: number;
  topic: { week: number; day: number; title: string; objective: string } | null;
}

async function buildContext(userId: string): Promise<TutorContextLite> {
  const profiles = await db.learnProfile.findMany({
    where: { userId },
    include: { course: { select: { name: true, domain: true, level: true } } },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });
  const primary = profiles[0];
  if (!primary) {
    return {
      courseId: null,
      courseName: null,
      courseDomain: null,
      courseLevel: null,
      totalXP: 0,
      streak: 0,
      topic: null,
    };
  }

  const today = await getTodayTopic(userId, primary.courseId).catch(() => null);
  return {
    courseId: primary.courseId,
    courseName: primary.course.name,
    courseDomain: primary.course.domain,
    courseLevel: primary.course.level,
    totalXP: primary.totalXP,
    streak: primary.streakCurrent,
    topic: today && !today.completed
      ? {
          week: today.topic.week,
          day: today.topic.day,
          title: today.topic.title,
          objective: today.topic.objective,
        }
      : null,
  };
}


