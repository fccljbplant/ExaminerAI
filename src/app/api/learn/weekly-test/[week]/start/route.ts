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
 * SEQUENCE (user model 2026-09): weeks/days are a management structure
 * — the learner sets the pace (three days in one day is fine). The
 * weekly test for week W unlocks only once the learner has REACHED the
 * last day of week W (server-enforced below); daily tests happen along
 * the way. Difficulty adapts to the learner's recent test scores.
 *
 * Returns: { testId, week, questions: [{ question, format, conceptId }], status, answers }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError, ErrorCode } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getCourseOutline } from "@/modules/learn/lib/course-outline";
import { learnerReachedTopic } from "@/modules/learn/lib/today-topic";
import { getLearnerDifficulty } from "@/modules/learn/lib/learner-difficulty";
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

  // ── SEQUENCE GUARD (server-enforced) ─────────────────────────────
  // The UI only offers the weekly test on a week's LAST day, but the
  // API must not rely on the UI: starting week W's test before the
  // learner has reached its last day would be out of sequence.
  // Learner-paced, not calendar-based — "reached" means their current
  // topic is on/after that day, or they already completed the course.
  const lastDayOfWeek = weekDays.length;
  if (lastDayOfWeek > 0) {
    const reached = await learnerReachedTopic(user.sub, courseId, week, lastDayOfWeek);
    if (!reached) {
      return apiError(
        `Weekly test for week ${week} unlocks after you finish its ${lastDayOfWeek} days — keep going!`,
        ErrorCode.OUT_OF_SEQUENCE,
        409,
      );
    }
  }

  // Question difficulty ADAPTS TO THE LEARNER (2026-09): derived from
  // this learner's own recent daily/weekly test scores for THIS course.
  const difficulty = await getLearnerDifficulty(user.sub, courseId);

  const systemPrompt = [
    "You are an expert AI tutor on the TraineesAI Learn platform. Generate a weekly test covering one week of a course. The questions CHECK UNDERSTANDING and TEACH through the asking.",
    "The JSON must conform to this schema.",
    "Rules:",
    ` - Exactly ${TARGET_QUESTION_COUNT} questions, spread across the week's days.`,
    " - Mix 'open' (one-sentence answer), 'short' (a few words) and 'probe' (Socratic follow-up).",
    " - Ask WHY / HOW / WHAT-IF questions that probe understanding and application — never bare definitions or yes/no recall.",
    ` - Difficulty is calibrated to THIS learner's level: ${difficulty.level}/5 (${difficulty.label}). ${difficulty.directive}`,
    " - Vary the cognitive demand across the 10 questions but keep the overall band.",
    " - Anchor questions in concrete work situations (the learner is an internee on the job).",
    " - conceptId = the day number the question covers (e.g. 'day-1').",
    " - No prose outside the JSON.",
  ].join("\n");

  const userPrompt = [
    `Learner difficulty level: ${difficulty.level}/5 (${difficulty.label}) — from this learner's recent test performance in this course.`,
    `Week ${week} material:`,
    ...weekDays.map(
      (d: { title?: string; objective?: string; activity?: string | null; deliverable?: string | null }, i: number) =>
        [
          `Day ${i + 1}: ${d.title ?? ""} — ${d.objective ?? ""}`,
          d.activity ? `  activity: ${d.activity}` : "",
          d.deliverable ? `  deliverable: ${d.deliverable}` : "",
        ].filter(Boolean).join("\n"),
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
      // DeepSeek V4 reasons before answering — a tight cap empties
      // `content` and silently degrades to canned questions. 2000
      // covers reasoning + 10 teaching-quality questions + valid JSON.
      maxTokens: 2000,
      // Weekly questions recur for every learner in the same
      // (course, week) — cache per token-cache.ts policy.
      cacheable: true,
      cacheTtlMs: 6 * 60 * 60 * 1000,
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

  // Attach per-question topic context so the answer route can TEACH the
  // right day's material when grading (no re-derivation, no drift).
  // difficultyLevel/Label ride on every question (additive JSON) so a
  // resumed test still shows its band without a schema migration.
  questions = questions.map((q) => {
    const dayIdx = Math.max(0, Number(String(q.conceptId).replace("day-", "")) - 1);
    const day = weekDays[dayIdx] ?? weekDays[0];
    return {
      ...q,
      topicTitle: day?.title ?? `Week ${week} material`,
      topicObjective: day?.objective ?? "",
      difficultyLevel: difficulty.level,
      difficultyLabel: difficulty.label,
    };
  });

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

  return apiSuccess({
    testId: test.id,
    week,
    questions,
    status: "in_progress",
    answers: [],
    difficulty: { level: difficulty.level, label: difficulty.label },
  });
}
