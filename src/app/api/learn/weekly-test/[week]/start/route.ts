/**
 * POST /api/learn/weekly-test/[week]/start
 *
 * Body: { courseId }
 *
 * Starts (or returns) the course-scoped weekly test for the given
 * week. Generates 10 questions from THAT course's outline days for the
 * week (CourseDay rows; falls back to the shared topic ladder when the
 * course has no outline). Idempotent on (userId, courseId, week).
 *
 * Returns: { testId, week, questions: [{ question, format, conceptId }], status, answers }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getCourseOutline } from "@/modules/learn/lib/course-outline";
import { WEEKLY_TOPICS } from "@/modules/course/lib/course-topics";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUESTION_SCHEMA = z
  .array(
    z.object({
      question: z.string().min(1),
      format: z.enum(["open", "short", "probe"]),
      conceptId: z.string().default(""),
    }),
  )
  .min(1)
  .max(12);

const TARGET_QUESTION_COUNT = 10;

export async function POST(req: Request, ctx: { params: Promise<{ week: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { week: weekStr } = await ctx.params;
  const week = Number(weekStr);
  if (!Number.isInteger(week) || week < 1 || week > 52) {
    return apiValidationError({ week: "week must be an integer 1-52" });
  }

  let body: { courseId?: string } = {};
  try {
    body = await req.json();
  } catch (err) {
    logger.warn("body parse failed", { err });
  }
  const courseId = body.courseId;
  if (!courseId) return apiValidationError({ courseId: "courseId is required" });

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiNotFound("Course not found");

  await getOrCreateProfile(user.sub, courseId);

  // Idempotent — if the weekly test exists for this (user, course, week), return it.
  const existing = await db.learnWeeklyTest.findUnique({
    where: { userId_courseId_week: { userId: user.sub, courseId, week } },
  });
  if (existing) {
    return apiSuccess({
      testId: existing.id,
      week,
      questions: existing.questions,
      status: existing.status,
      answers: existing.answers ?? [],
    });
  }

  // Week material: the course's outline days for this week (or the shared ladder).
  const outline = await getCourseOutline(courseId).catch(() => null);
  const outlineWeek = outline?.find((w) => w.week === week);
  const weekDays = outlineWeek?.days ?? WEEKLY_TOPICS[week - 1]?.topics ?? [];

  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform. Generate a weekly test covering one week of a course.",
    "Respond with ONLY a JSON array. No prose, no markdown fences.",
    "Each item: { question: string, format: 'open'|'short'|'probe', conceptId: string }.",
    "Rules:",
    ` - Exactly ${TARGET_QUESTION_COUNT} questions, spread across the week's days.`,
    " - Mix 'open' (one-sentence answer), 'short' (a few words) and 'probe' (Socratic follow-up).",
    " - conceptId = the day number the question covers (e.g. 'day-1').",
  ].join("\n");

  const userPrompt = [
    `Week ${week} material:`,
    ...weekDays.map(
      (d: { title?: string; objective?: string }, i: number) =>
        `Day ${i + 1}: ${d.title ?? ""} — ${d.objective ?? ""}`,
    ),
  ].join("\n");

  const result = await callAIJson<z.infer<typeof QUESTION_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: QUESTION_SCHEMA,
      feature: "learn-weekly-test-start",
      userId: user.sub,
      temperature: 0.5,
      maxTokens: 800,
    },
  );

  let questions: z.infer<typeof QUESTION_SCHEMA>;
  if (!result.ok || result.data.length === 0) {
    logger.warn("learn weekly-test AI failed, using fallback", {
      error: result.ok ? "empty response" : result.error,
    });
    // Fallback: two questions per day (or fill from the week's topics).
    questions = [];
    for (const [i, d] of weekDays.entries()) {
      if (questions.length >= TARGET_QUESTION_COUNT) break;
      const title = d.title ?? `Week ${week} material`;
      questions.push({ question: `In one sentence: what is ${title}?`, format: "open", conceptId: `day-${i + 1}` });
      if (questions.length < TARGET_QUESTION_COUNT) {
        questions.push({ question: `Give one concrete example of: ${title}.`, format: "short", conceptId: `day-${i + 1}` });
      }
    }
    while (questions.length < TARGET_QUESTION_COUNT) {
      questions.push({ question: `Explain one key idea from week ${week} and why it matters.`, format: "open", conceptId: "week" });
    }
  } else {
    questions = result.data.slice(0, TARGET_QUESTION_COUNT);
  }

  // Persist the test.
  const test = await db.learnWeeklyTest.create({
    data: {
      userId: user.sub,
      courseId,
      week,
      questions: questions as unknown as object,
      status: "in_progress",
    },
  });

  return apiSuccess({ testId: test.id, week, questions, status: "in_progress", answers: [] });
}
