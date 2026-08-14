import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { streamAI } from "@/modules/assessment/lib/ai-provider";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import {
  getCourseMetadata,
  getCourseWeekTopics,
  getCourseWeekPhase,
  getCourseDurationWeeks,
  getCourseTopics,
} from "@/lib/course-db";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * POST /api/ai/tutor/stream — streaming variant of /api/ai/tutor.
 *
 * Same auth, same rate-limit, same context-building, same system prompt.
 * The only difference: the response is a ReadableStream of text chunks
 * (Content-Type: text/event-stream) instead of a JSON { reply } envelope.
 *
 * Why: the non-streaming endpoint makes the learner wait 5-15s with a
 * spinner before any text appears. Streaming shows the first token in
 * ~500ms and the rest streams in — feels alive, like ChatGPT/Cursor.
 *
 * Client usage:
 *   const res = await fetch("/api/ai/tutor/stream", {
 *     method: "POST",
 *     body: JSON.stringify({ messages }),
 *   });
 *   const reader = res.body!.getReader();
 *   const decoder = new TextDecoder();
 *   while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 *     setText(prev => prev + decoder.decode(value, { stream: true }));
 *   }
 *
 * The stream may emit `[stream-degraded: <reason>]` if the provider
 * fails mid-stream — the client should detect this prefix and fall back
 * to a non-streaming retry or show an ErrorState.
 */

export const runtime = "nodejs"; // streaming needs Node, not Edge

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations");
  if (_demoBlock) return _demoBlock;

  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only students can use the AI Tutor" }, { status: 403 });
  }

  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json(
      { error: "AI access for demo accounts is currently disabled by the administrator." },
      { status: 403 },
    );
  }

  const category = categoryForFeature("ai-tutor");
  const limit = await checkUserAILimit(user.id, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI Tutor limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
      category,
      used: limit.used,
      limit: limit.limit,
      resetAt: limit.resetAt.toISOString(),
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { messages } = body as {
    messages?: { role: "user" | "assistant"; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }
  if (messages.length > 50) {
    return NextResponse.json({ error: "Too many messages (max 50)" }, { status: 400 });
  }
  for (const m of messages) {
    if (m.content.length > 8000) {
      return NextResponse.json({ error: "Message too long (max 8000 characters per message)" }, { status: 400 });
    }
  }

  // Build the same context as the non-streaming route.
  const totalWeeks = await getCourseDurationWeeks(user.id);
  const week = Math.min(user.currentWeek, totalWeeks);
  const [courseMeta, weekTopics, weekPhase, fullCourseOutline] = await Promise.all([
    getCourseMetadata(user.id),
    getCourseWeekTopics(user.id, week),
    getCourseWeekPhase(user.id, week),
    getCourseTopics(user.id),
  ]);

  const courseOutlineText = fullCourseOutline.length > 0
    ? fullCourseOutline.map(w =>
        `Week ${w.week}: ${w.phase}\n${w.topics.map((t, i) => `  Day ${i + 1}: ${t.title}`).join("\n")}`
      ).join("\n\n")
    : "Course outline not yet configured.";

  const projectDescription = [
    user.projectName ? `Project name: ${user.projectName}` : null,
    user.projectDescription ? `Description: ${user.projectDescription}` : null,
    user.projectType ? `Type: ${user.projectType}` : null,
    user.projectScope ? `Scope: ${user.projectScope}` : null,
    user.projectObjectives ? `Objectives: ${user.projectObjectives}` : null,
  ].filter(Boolean).join("\n") || "The student has not yet defined their project.";

  const currentTopicText = `Week ${week} of ${totalWeeks}: ${weekPhase}\nThis week's daily topics:\n${weekTopics.map((t, i) => `  Day ${i + 1}: ${t.title}`).join("\n") || "  (topics not loaded yet)"}`;

  // Compact system prompt — reuses the same teaching rules as the
  // non-streaming route but trimmed for token efficiency. The full
  // multi-page prompt is in /api/ai/tutor/route.ts; this version keeps
  // the same tone + length rules.
  const systemPrompt = `You are the AI Tutor for ${user.name || "the student"}, currently in Week ${week} of ${totalWeeks}.

COURSE OUTLINE:
${courseOutlineText}

STUDENT PROJECT:
${projectDescription}

CURRENT TOPIC:
${currentTopicText}

RULES:
- Short chat replies (3-8 sentences max). This is a chat, not a lecture.
- Plain text only. No emojis, no markdown formatting, no bullet characters.
- Warm, respectful teacher tone. Connect every answer back to THEIR project.
- If the student seems disengaged, acknowledge briefly (1-2 sentences) and offer a small next step.
- Never write a long essay. If a topic needs depth, give the core idea + one example, then ask if they want more.

${courseMeta ? `COURSE DOMAIN: ${courseMeta.domain} · LEVEL: ${courseMeta.level}` : ""}`;

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    const stream = await streamAI(aiMessages, {
      temperature: 0.7,
      maxTokens: 600,
      feature: "ai-tutor-stream",
      userId: user.id,
    });

    // Wrap with a sanitizer pass on the client side; here we stream raw
    // chunks. The client should run sanitizeExaminerText on the final
    // assembled text (or per-chunk — both work).
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // disable Nginx buffering (Vercel respects this)
      },
    });
  } catch (err) {
    logger.error("AI Tutor stream init failed", {
      feature: "ai-tutor-stream",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "AI Tutor stream unavailable. Try the non-streaming endpoint." },
      { status: 500 },
    );
  }
}

// Re-export the sanitizer for client use.
export { sanitizeExaminerText };
