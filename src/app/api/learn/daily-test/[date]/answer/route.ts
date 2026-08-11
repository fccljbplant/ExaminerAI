/**
 * POST /api/learn/daily-test/[date]/answer
 *
 * Body: { testId, questionIdx, answer }
 *
 * Evaluates one answer in a daily test via AI. Persists the evaluation
 * to LearnDailyTest.answers (array index = questionIdx). When the last
 * question is answered, marks the test as completed, computes the final
 * score (0-3), and awards XP_AMOUNTS.daily_test_done (30).
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

export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  await ctx.params; // validate route shape

  let body: { testId?: string; questionIdx?: number; answer?: string } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  const { testId, questionIdx, answer } = body;
  if (!testId) return apiValidationError({ testId: "testId is required" });
  if (typeof questionIdx !== "number" || questionIdx < 0) return apiValidationError({ questionIdx: "questionIdx must be a non-negative number" });
  if (!answer || !answer.trim()) return apiValidationError({ answer: "answer is required" });

  const test = await db.learnDailyTest.findUnique({ where: { id: testId } });
  if (!test) return apiNotFound("Test not found");
  if (test.userId !== user.sub) return apiError("This test belongs to another user", "FORBIDDEN", 403);
  if (test.status === "completed") return apiError("Test is already completed", "CONFLICT", 409);

  const questions = test.questions as any[];
  if (questionIdx >= questions.length) return apiValidationError({ questionIdx: "out of range" });
  const questionObj = questions[questionIdx];

  // AI evaluation.
  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform. Evaluate the learner's answer to a daily-test question.",
    "Respond with ONLY a JSON object: { evaluation: 'correct'|'partial'|'incorrect', feedback: string, score: number(0..1) }.",
    "Rules:",
    " - 'correct' (score 1.0) = the answer is substantively right.",
    " - 'partial' (score 0.5) = right direction but missing key pieces.",
    " - 'incorrect' (score 0.0) = wrong or off-topic.",
    " - feedback = 1-2 sentences. Be encouraging and concrete. Mention what was right (if anything) and what was missing.",
  ].join("\n");

  const userPrompt = [
    `Question: ${questionObj.question}`,
    `Format: ${questionObj.format}`,
    `Learner's answer: ${answer}`,
  ].join("\n");

  const result = await callAIJson<z.infer<typeof EVAL_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: EVAL_SCHEMA,
      feature: "learn-daily-test-answer",
      userId: user.sub,
      temperature: 0.3,
      maxTokens: 200,
    },
  );

  let evaluation: z.infer<typeof EVAL_SCHEMA>;
  if (result.ok) {
    evaluation = result.data;
  } else {
    logger.warn("learn daily-test answer AI failed, fallback", { error: result.error });
    evaluation = {
      evaluation: "partial",
      feedback: "I couldn't fully evaluate your answer right now — I'll give you the benefit of the doubt. Review the topic and try the next question.",
      score: 0.5,
    };
  }

  // Persist answer to the answers JSON array (index = questionIdx).
  const answers = (test.answers as any[]) ?? [];
  // Pad the array if needed.
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
    finalScore = Math.round(
      answers.reduce<number>((sum, a) => sum + (a ? a.score : 0), 0) * 100,
    ) / 100;
    await db.learnDailyTest.update({
      where: { id: test.id },
      data: {
        answers: answers as any,
        status: "completed",
        score: finalScore,
        completedAt: new Date(),
        xpAwarded: 30,
      },
    });
    await awardTypedXP(user.sub, "daily_test_done", test.courseId, `daily-test:${test.id}`);
  } else {
    await db.learnDailyTest.update({
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
  });
}
