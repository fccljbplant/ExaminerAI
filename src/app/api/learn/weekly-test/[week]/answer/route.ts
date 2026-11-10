/**
 * POST /api/learn/weekly-test/[week]/answer
 *
 * Body: { testId, questionIdx, answer }
 *
 * Evaluates one answer in a course-scoped weekly test. Persists the
 * evaluation to LearnWeeklyTest.answers (index = questionIdx). When the
 * last question is answered, marks the test completed, computes the
 * final score (0..N) and awards XP_AMOUNTS.weekly_test_done (100) —
 * attributed to the test's course.
 *
 * Returns: { evaluation, feedback, score, isComplete, finalScore }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { awardTypedXP } from "@/modules/learn/lib/xp-ledger";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const EVAL_SCHEMA = z.object({
  evaluation: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string().min(1),
  score: z.number().min(0).max(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ week: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  await ctx.params; // validate route shape

  let body: { testId?: string; questionIdx?: number; answer?: string } = {};
  try {
    body = await req.json();
  } catch (err) {
    logger.warn("body parse failed", { err });
  }
  const { testId, questionIdx, answer } = body;
  if (!testId) return apiValidationError({ testId: "testId is required" });
  if (typeof questionIdx !== "number" || questionIdx < 0) {
    return apiValidationError({ questionIdx: "questionIdx must be a non-negative number" });
  }
  if (!answer || !answer.trim()) return apiValidationError({ answer: "answer is required" });

  const test = await db.learnWeeklyTest.findUnique({ where: { id: testId } });
  if (!test) return apiNotFound("Test not found");
  if (test.userId !== user.sub) return apiError("This test belongs to another user", "FORBIDDEN", 403);
  if (test.status === "completed") return apiError("Test is already completed", "CONFLICT", 409);

  const questions = test.questions as any[];
  if (questionIdx >= questions.length) return apiValidationError({ questionIdx: "out of range" });
  const questionObj = questions[questionIdx];

  const systemPrompt = [
    "You are an expert AI tutor on the TraineesAI Learn platform. Evaluate the learner's answer to a weekly-test question — and use your reply to TEACH.",
    "The JSON must conform to this schema.",
    "Rules:",
    " - 'correct' (score 1.0) = the answer is substantively right.",
    " - 'partial' (score 0.5) = right direction but missing key pieces.",
    " - 'incorrect' (score 0.0) = wrong or off-topic.",
    " - feedback is ALWAYS a teaching reply, never a bare verdict:",
    "   1. One short sentence acknowledging what the learner got right (or their effort if wrong).",
    "   2. Name the exact gap or misconception, kindly and specifically.",
    "   3. Teach the missing idea in plain words — with one concrete example or analogy from real work.",
    "   4. Close with ONE thing to review or try next (tie it to the topic objective).",
    " - 3-5 sentences total. Warm, direct, zero fluff. No grading jargon, no 'score' mention.",
    " - Never reveal or restate the expected full answer when the format is 'probe' — guide thinking instead.",
  ].join("\n");

  // Topic context stored on the question at start time (legacy tests
  // predate the field — the topic line is simply omitted for them).
  const stored = questionObj as { topicTitle?: string; topicObjective?: string };
  const topicLine = stored.topicTitle
    ? `Topic being tested: ${stored.topicTitle} — ${stored.topicObjective ?? ""}`
    : "";

  const userPrompt = [
    topicLine,
    `Question: ${questionObj.question}`,
    `Question format: ${questionObj.format} ('open' expects a one-sentence answer, 'short' a few words, 'probe' is a Socratic follow-up — judge the answer against its own format, not against an essay)`,
    `Learner's answer: ${answer}`,
  ].filter(Boolean).join("\n");

  const result = await callAIJson<z.infer<typeof EVAL_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: EVAL_SCHEMA,
      feature: "learn-weekly-test-answer",
      userId: user.sub,
      temperature: 0.3,
      // DeepSeek V4 is a hybrid reasoning model: with a tight
      // max_tokens the budget is spent on reasoning and `content`
      // comes back EMPTY (provider falls back to reasoning text, which
      // is not JSON) → every evaluation silently degraded. 1200 leaves
      // room for reasoning + a teaching reply + valid JSON.
      maxTokens: 1200,
    },
  );

  let evaluation: z.infer<typeof EVAL_SCHEMA>;
  if (result.ok) {
    evaluation = result.data;
  } else {
    logger.warn("learn weekly-test answer AI failed, fallback", { error: result.error });
    evaluation = {
      evaluation: "partial",
      feedback: "I couldn't fully evaluate your answer right now — I'll give you the benefit of the doubt. Review the week's material and try the next question.",
      score: 0.5,
    };
  }

  // Persist answer to the answers JSON array (index = questionIdx).
  const answers = (test.answers as any[]) ?? [];
  while (answers.length < questionIdx) answers.push(null);
  answers[questionIdx] = {
    answer,
    evaluation: evaluation.evaluation,
    score: evaluation.score,
    feedback: evaluation.feedback,
  };

  const isComplete = answers.filter(Boolean).length >= questions.length;

  let finalScore: number | undefined;
  if (isComplete) {
    finalScore =
      Math.round(answers.reduce<number>((sum, a) => sum + (a ? a.score : 0), 0) * 100) / 100;
    await db.learnWeeklyTest.update({
      where: { id: test.id },
      data: {
        answers: answers as any,
        status: "completed",
        score: finalScore,
        completedAt: new Date(),
        xpAwarded: 100,
      },
    });
    await awardTypedXP(user.sub, "weekly_test_done", test.courseId, `weekly-test:${test.id}`);
  } else {
    await db.learnWeeklyTest.update({
      where: { id: test.id },
      data: { answers: answers as any },
    });
  }

  return apiSuccess({
    evaluation: evaluation.evaluation,
    feedback: evaluation.feedback,
    score: evaluation.score,
    isComplete,
    finalScore: isComplete ? finalScore : null,
    // Generic degradation reason when the AI path failed (no secrets).
    aiError: result.ok ? null : result.error,
  });
}
