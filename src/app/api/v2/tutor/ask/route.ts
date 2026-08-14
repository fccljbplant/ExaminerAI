import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { streamAI } from "@/modules/assessment/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getTutorContext } from "@/modules/learn/lib/study-flow-db";
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
  // W3 scenario packet — absence / cram / exam proximity. Degrades to a
  // normal prompt when the study-flow engine can't resolve the learner
  // (no enrollment, flag off): the tutor must never fail because a
  // scenario lookup did.
  const studyFlow = context.courseId
    ? await getTutorContext(user.sub, context.courseId, surface ?? "").catch(() => null)
    : null;
  const systemPrompt = buildSystemPrompt(user.name, surface, context, studyFlow);

  try {
    const stream = await streamAI(
      [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      { temperature: 0.7, maxTokens: 600, feature: "ai-tutor-v2", userId: user.sub }
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

function buildSystemPrompt(
  learnerName: string,
  surface: string | undefined,
  ctx: TutorContextLite,
  studyFlow: TutorContextResult | null,
): string {
  const courseBlock = ctx.courseName
    ? [
        `COURSE: ${ctx.courseName}${ctx.courseDomain ? ` (domain: ${ctx.courseDomain})` : ""}${ctx.courseLevel ? ` · level: ${ctx.courseLevel}` : ""}`,
        `LEARNER STATUS: ${ctx.totalXP} XP · ${ctx.streak}-day streak`,
        ctx.topic
          ? `CURRENT LESSON: Week ${ctx.topic.week}, Day ${ctx.topic.day} — ${ctx.topic.title}. Objective: ${ctx.topic.objective}`
          : "The learner is between lessons.",
      ].join("\n")
    : "The learner is not enrolled in a course yet — help them explore the catalog and pick one.";

  // W3 scenario packet — only when a non-normal scenario is active.
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

  return `You are the AI study tutor for ${learnerName || "the learner"} on TraineesAI, a training platform that teaches any subject.
${surface ? `The learner is asking from: ${surface}` : ""}

${courseBlock}
${scenarioBlock ? `\n${scenarioBlock}\n` : ""}
RULES:
- Short chat replies (3-8 sentences). This is a chat, not a lecture.
- Plain text only: no emojis, no markdown, no bullet characters.
- Warm, respectful teacher tone; domain-neutral wording whatever the subject.
- You are TEXT-ONLY: you cannot open files, images, audio or video. If asked to read media, say plainly that you work with text and ask the learner to describe or paste it. Never fabricate content you cannot see.
- Connect answers to the current lesson when one is active; otherwise help plan or review.
- Never guilt the learner about absence or pace — every scenario offer is framed as a helpful choice.
- If a topic needs depth, give the core idea plus one example, then ask if they want more.`;
}
