/**
 * POST /api/learn/sessions/[id]/ask
 *
 * Body: { question }
 *
 * Tutor session Q&A — answers a learner question using RAG over the
 * course's existing LearnSlide content. Every answer cites the
 * [Week/Day/Slide] the answer was drawn from.
 *
 * Flow:
 *  1. Load the TutorSession (must belong to the authed user).
 *  2. Fetch all slides for the course (cheap — small dataset).
 *  3. Build a "course knowledge" context block from slide titles +
 *     bullets + keyTerms + analogy.
 *  4. Call callAI with a system prompt that demands a cited answer.
 *  5. Persist both messages (student + tutor) to TutorMessage.
 *
 * Returns: { answer, citation }
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiError, apiForbidden, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAI } from "@/modules/assessment/lib/ai-provider";
import { LEVEL_DIRECTIVES, type TeachingLevel } from "@/modules/learn/types";
import { getTutorStudentContext, tutorContextBlocks } from "@/modules/learn/lib/tutor-context";

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

  // RAG: load all slides for this course.
  const slides = await db.learnSlide.findMany({
    where: { courseId: session.courseId },
    orderBy: { slideOrder: "asc" },
    include: { narrations: true },
  });

  // Build a compact knowledge block: each slide is one block.
  const knowledgeBlocks = slides.map((s) => {
    const meta = s.moduleId ?? "0-0"; // "{week}-{day}"
    const [w, d] = meta.split("-");
    const citation = `[Week ${w}/Day ${d}/Slide ${s.slideOrder}]`;
    const bullets = (s.bullets as string[]).map((b) => `  • ${b}`).join("\n");
    const keyTerms = (s.keyTerms as string[]).length ? `Key terms: ${(s.keyTerms as string[]).join(", ")}` : "";
    const analogy = s.analogy ? `Analogy: ${s.analogy}` : "";
    const rwe = s.realWorldExample ? `Real-world example: ${s.realWorldExample}` : "";
    return `${citation} ${s.title}\n${bullets}${keyTerms ? "\n" + keyTerms : ""}${analogy ? "\n" + analogy : ""}${rwe ? "\n" + rwe : ""}`;
  });
  const knowledge = knowledgeBlocks.join("\n\n---\n\n") || "(The tutor is preparing slides for this topic — answer from general knowledge and cite the topic.)";

  // Build the conversation history (last 8 messages, compact).
  const history = session.messages
    .slice(-8)
    .map((m) => ({
      role: m.role === "student" ? "user" : "assistant",
      content: m.content.slice(0, 800),
    })) as { role: "user" | "assistant"; content: string }[];

  const level = (session.teachingLevel ?? 4) as TeachingLevel;

  // W15: the tutor knows the learner — today's topic, scores, project.
  // Degrades to empty blocks on any lookup failure (never breaks Q&A).
  const studentCtx = await getTutorStudentContext(user.sub).catch(() => null);
  const studentBlocks = studentCtx ? tutorContextBlocks(studentCtx) : "";

  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform.",
    LEVEL_DIRECTIVES[level],
    "Below is the course knowledge base — each block starts with a [Week/Day/Slide] citation. ALWAYS ground your answer in these blocks. If the answer is in the KB, cite the [Week/Day/Slide] tag at the end of your answer. If the KB does not cover the question, say so honestly and offer to explain at a higher level using general knowledge (no citation).",
    "Keep answers short — 3-6 sentences. No code blocks unless the question specifically asks for code. No URLs. No markdown tables.",
    "LANGUAGE: use very simple English — short sentences, everyday words, polite and encouraging, like a friendly mentor to a beginner. Explain any technical term the first time you use it.",
    "Use the STUDENT CONTEXT to personalize every answer: reference their current lesson, encourage based on their scores, and point at weak topics when they ask what to review. When they ask about their project, coach from the PROJECT block — and if they have no project yet, help them choose one aligned with the course domain and break it into milestone-sized first steps.",
    "",
    "=== STUDENT CONTEXT ===",
    studentBlocks || "(No learner data yet.)",
    "",
    "=== COURSE KNOWLEDGE BASE ===",
    knowledge,
  ].join("\n");

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    { role: "user" as const, content: question },
  ];

  const result = await callAI(messages, {
    feature: "learn-tutor-ask",
    userId: user.sub,
    temperature: 0.4,
    maxTokens: 600,
  });

  const answer = result.text || "I'm sorry — I couldn't generate an answer just now. Please try again in a moment.";

  // Extract the first [Week/Day/Slide] citation if present (best-effort).
  const citationMatch = answer.match(/\[Week\s*\d+\/Day\s*\d+\/Slide\s*\d+\]/i);
  const citation = citationMatch ? citationMatch[0] : null;

  // Persist the tutor's answer.
  await db.tutorMessage.create({
    data: {
      sessionId,
      role: "tutor",
      content: answer,
      messageType: "text",
      ...(citation ? { metadata: { citation } as unknown as Prisma.InputJsonValue } : {}),
    },
  });

  return apiSuccess({ answer, citation });
}
