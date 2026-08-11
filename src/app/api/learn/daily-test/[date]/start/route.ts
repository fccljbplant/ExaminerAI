/**
 * POST /api/learn/daily-test/[date]/start
 *
 * Body: { courseId }
 *
 * Starts (or returns) the daily test for the given date. Generates 3
 * questions:
 *   - 2 questions on today's topic (the current topic in masteryMap)
 *   - 1 spaced-repetition question from a previously completed topic
 *     (random pick from masteryMap.history; if none, all 3 from today)
 *
 * Idempotent on (userId, courseId, date) — calling start twice returns
 * the same test.
 *
 * Returns: { testId, questions: [{ question, format, conceptId, isSpacedRepetition }] }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { getTodayTopic, getTopicByWeekDay } from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUESTION_SCHEMA = z.array(
  z.object({
    question: z.string().min(1),
    format: z.enum(["open", "short", "probe"]),
    conceptId: z.string().default(""),
    isSpacedRepetition: z.boolean().default(false),
  }),
).min(1).max(5);

function parseDateParam(s: string): Date | null {
  // Accept YYYY-MM-DD only.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { date: dateStr } = await ctx.params;
  const date = parseDateParam(dateStr);
  if (!date) return apiValidationError({ date: "date must be YYYY-MM-DD" });

  let body: { courseId?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const courseId = body.courseId;
  if (!courseId) return apiValidationError({ courseId: "courseId is required" });

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiNotFound("Course not found");

  await getOrCreateProfile(user.sub, courseId);

  // Idempotent — if test exists, return it.
  const existing = await db.learnDailyTest.findUnique({
    where: { userId_courseId_date: { userId: user.sub, courseId, date } },
  });
  if (existing) {
    return apiSuccess({
      testId: existing.id,
      questions: existing.questions,
      status: existing.status,
      answers: existing.answers ?? [],
    });
  }

  // Today's topic for the 2 fresh questions.
  const today = await getTodayTopic(user.sub, courseId);
  if (!today) return apiError("Course is complete — no topic to test on", "NOT_FOUND", 404);

  // Spaced repetition — pick a random previously completed topic.
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
  });
  const mastery = (profile?.masteryMap as any)?.topicProgress ?? { history: [] };
  const history: { week: number; day: number }[] = mastery.history ?? [];
  let srTopic: { title: string; objective: string; resources: { label: string; url: string }[] } | null = null;
  if (history.length > 0) {
    const pick = history[Math.floor(Math.random() * history.length)];
    srTopic = getTopicByWeekDay(pick.week, pick.day);
  }

  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform. Generate a short daily test.",
    "Respond with ONLY a JSON array. No prose, no markdown fences.",
    "Each item: { question: string, format: 'open'|'short'|'probe', conceptId: string, isSpacedRepetition: boolean }.",
    "Rules:",
    " - Exactly 3 questions.",
    " - Questions 1 and 2 cover TODAY's topic. Question 3 is a spaced-repetition question on a PAST topic.",
    " - 'open' = one-sentence answer, 'short' = a few words, 'probe' = a Socratic follow-up.",
    " - conceptId = 'today' for Q1+Q2, 'sr' for Q3.",
    " - isSpacedRepetition = false for Q1+Q2, true for Q3.",
  ].join("\n");

  const userPrompt = [
    `Today's topic (Q1+Q2):`,
    `Week ${today.topic.week} Day ${today.topic.day}: ${today.topic.title}`,
    `Objective: ${today.topic.objective}`,
    ``,
    srTopic
      ? `Spaced-repetition topic (Q3): ${srTopic.title} — ${srTopic.objective}`
      : `Spaced-repetition topic: none available yet — make all 3 questions on today's topic, but mark Q3's isSpacedRepetition=false and conceptId='today'.`,
  ].join("\n");

  const result = await callAIJson<z.infer<typeof QUESTION_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: QUESTION_SCHEMA,
      feature: "learn-daily-test-start",
      userId: user.sub,
      temperature: 0.5,
      maxTokens: 500,
    },
  );

  let questions;
  if (result.ok) {
    questions = result.data;
  } else {
    logger.warn("learn daily-test AI failed, using fallback", { error: result.error });
    questions = [
      { question: `In one sentence: what is ${today.topic.title}?`, format: "open" as const, conceptId: "today", isSpacedRepetition: false },
      { question: `Give one concrete example of: ${today.topic.title}.`, format: "short" as const, conceptId: "today", isSpacedRepetition: false },
      srTopic
        ? { question: `Recall: ${srTopic.title} — explain it in one sentence.`, format: "open" as const, conceptId: "sr", isSpacedRepetition: true }
        : { question: `Why does ${today.topic.title} matter in a real project?`, format: "open" as const, conceptId: "today", isSpacedRepetition: false },
    ];
  }

  // Persist the test.
  const test = await db.learnDailyTest.create({
    data: {
      userId: user.sub,
      courseId,
      date,
      questions: questions as any,
      status: "in_progress",
    },
  });

  return apiSuccess({ testId: test.id, questions, status: "in_progress", answers: [] });
}
