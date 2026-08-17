/**
 * POST /api/learn/sessions/[id]/ask
 *
 * Body: { question }
 *
 * Tutor session Q&A — answers a learner question using RAG over the
 * course's CourseEmbedding index (slides, course days, narrations,
 * materials). Every answer cites the [Week/Day/Slide] or material
 * source the answer was drawn from; retrieval falls back to the legacy
 * full-course slide block when the index has nothing useful.
 *
 * Flow:
 *  1. Load the TutorSession (must belong to the authed user).
 *  2. retrieveForQuery() → top-5 chunks (cosine or keyword fallback).
 *  3. Build the knowledge block (or the legacy full-course block).
 *  4. Call callAI with a system prompt that demands a cited answer.
 *  5. Persist both messages (student + tutor) to TutorMessage.
 *
 * Returns: { answer, citation }
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiError, apiForbidden, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { LEVEL_DIRECTIVES, type TeachingLevel } from "@/modules/learn/types";
import { getTutorStudentContext, tutorContextBlocks } from "@/modules/learn/lib/tutor-context";
import { buildTutorBlocksFromPacks, universalTutorSystemPrompt } from "@/modules/ai";
import { buildKnowledgeBlock } from "@/modules/ai/lib/rag";
import { getFullCourseSlidesBlock, retrieveForQuery } from "@/modules/ai/lib/rag-db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { id: sessionId } = await ctx.params;
  const session = await db.tutorSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
  });
  if (!session) return apiNotFound("Tutor session not found");
  if (session.userId !== user.sub) return apiForbidden("This session belongs to another user");

  let body: { question?: string } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  const question = (body.question ?? "").trim();
  if (!question) return apiValidationError({ question: "question is required" });
  if (question.length > 2000) return apiValidationError({ question: "question too long (2000 char max)" });

  // Persist the student's question.
  await db.tutorMessage.create({
    data: { sessionId, role: "student", content: question, messageType: "text" },
  });

  // RAG: retrieve the most relevant knowledge chunks for this question.
  // If retrieval comes back empty (or scores 0), fall back to the legacy
  // full-course prompt-stuffing block.
  let knowledge: string;
  let sources: string[] = [];
  try {
    const chunks = await retrieveForQuery(session.courseId, question, 5);
    const useful = chunks.filter((c) => c.score > 0);
    if (useful.length > 0) {
      knowledge = buildKnowledgeBlock(useful);
      sources = useful.map((c) => c.citation);
    } else {
      knowledge = await getFullCourseSlidesBlock(session.courseId);
    }
  } catch (err) {
    logger.warn("RAG retrieval failed — falling back to full-course block", {
      error: err instanceof Error ? err.message : String(err),
    });
    knowledge = await getFullCourseSlidesBlock(session.courseId);
  }

  // Build the conversation history (last 8 messages, compact).
  const history = session.messages
    .slice(-8)
    .map((m) => ({
      role: m.role === "student" ? "user" : "assistant",
      content: m.content.slice(0, 800),
    })) as { role: "user" | "assistant"; content: string }[];

  const level = (session.teachingLevel ?? 4) as TeachingLevel;

  // W15 + cacheable universal tutor (2026-08-15): the system prompt is
  // the static universal rules + the lesson KB (stable within a lesson);
  // the anonymized student blocks move into a stable leading user
  // message so system + context form the cacheable prefix.
  const studentCtx = await getTutorStudentContext(user.sub, session.courseId).catch(() => null);
  const studentBlocks =
    studentCtx?.courseId && studentCtx.topic
      ? await buildTutorBlocksFromPacks(user.sub, studentCtx.courseId, {
          week: studentCtx.topic.week,
          day: studentCtx.topic.day,
        }).catch(() => "")
      : studentCtx
        ? tutorContextBlocks(studentCtx)
        : "";

  const systemPrompt = [
    universalTutorSystemPrompt(),
    LEVEL_DIRECTIVES[level],
    "Below is the course knowledge base — each block starts with a `Citation:` line identifying its source (e.g. `Week 2 Day 3 · Slide 2` or `Material: ...`). ALWAYS ground your answer in these blocks. If the answer is in the KB, cite the source tag at the end of your answer. If the KB does not cover the question, say so honestly and offer to explain at a higher level using general knowledge (no citation).",
    "",
    "=== COURSE KNOWLEDGE BASE ===",
    knowledge,
  ].join("\n");

  const contextMessage = [
    "=== STUDENT CONTEXT ===",
    studentBlocks || "(No learner data yet.)",
  ].join("\n");

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: contextMessage },
    ...history,
    { role: "user" as const, content: question },
  ];

  let answer: string;
  let citation: string | null = null;
  try {
    // Proper JSON mode: the provider enforces JSON output
    // (response_format json_object) and the AI returns the reply in a
    // structured envelope — no local scraping or reply engineering.
    const result = await callAIJson<{ reply: string; citation?: string | null }>(
      messages,
      {
        schema: z.object({
          reply: z.string().min(1),
          citation: z.string().nullable().optional(),
        }),
        feature: "learn-tutor-ask",
        userId: user.sub,
        temperature: 0.7,
        maxTokens: 600, // keep replies SHORT — chat, not essays
        jsonInstruction:
          "Respond with ONLY a valid JSON object matching the schema. " +
          "Put the entire visible chat message in `reply` (plain flowing text, 3-8 sentences, " +
          "no reasoning, no notes to yourself, no [Coherence Check], no formatting markers). " +
          "Set `citation` to the source tag from the knowledge base (e.g. `Week 2 Day 3 · Slide 2`) only when your answer came from the knowledge base; otherwise null.",
      },
    );
    if (result.ok) {
      answer = result.data.reply;
      citation = result.data.citation ?? null;
    } else {
      answer = "I'm having trouble responding right now — please try again in a moment. Your progress is safe.";
    }
  } catch (err) {
    logger.error("AI Tutor failed", { feature: "learn-tutor-ask", error: err instanceof Error ? err.message : String(err) });
    answer = "I'm having trouble responding right now — please try again in a moment. Your progress is safe.";
  }

  if (!answer.trim()) {
    answer = "I'm having trouble responding right now — please try again in a moment. Your progress is safe.";
  }

  // Persist the tutor's answer (citation comes from the AI's JSON;
  // `sources` records every knowledge chunk the answer was grounded on).
  await db.tutorMessage.create({
    data: {
      sessionId,
      role: "tutor",
      content: answer,
      messageType: "text",
      ...(citation || sources.length > 0
        ? { metadata: { citation: citation ?? null, sources } as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  return apiSuccess({ answer, citation });
}
