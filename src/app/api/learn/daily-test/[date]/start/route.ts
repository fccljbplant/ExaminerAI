/**
 * POST /api/learn/daily-test/[date]/start
 *
 * Body: { courseId }
 *
 * Starts (or returns) the daily test for the given date. Generates questions
 * from the most recently completed study topic, with an optional spaced-
 * repetition question from an earlier completed topic. The request is only
 * accepted after a learner has a valid, course-scoped completion record.
 *
 * Idempotent on (userId, courseId, date) — calling start twice returns
 * the same test.
 *
 * Returns: { testId, questions: [{ question, format, conceptId, isSpacedRepetition }] }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiDegraded, apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError, ErrorCode } from "@/lib/api-response";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { getTopicByWeekDay } from "@/modules/learn/lib/today-topic";
import { getCourseOutline, topicInOutline } from "@/modules/learn/lib/course-outline";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getLearnerDifficulty } from "@/modules/learn/lib/learner-difficulty";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

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

const GENERATED_QUESTION_SCHEMA = z.array(
  z.object({
    question: z.string().min(1),
    format: z.enum(["open", "short", "probe"]),
    conceptId: z.string().default(""),
    isSpacedRepetition: z.boolean().default(false),
  }),
).length(3);


const STORED_ANSWER_SCHEMA = z.object({
  answer: z.string(),
  evaluation: z.enum(["correct", "partial", "incorrect"]),
  score: z.number().min(0).max(1),
  feedback: z.string(),
});
const STORED_ANSWERS_SCHEMA = z.array(z.union([STORED_ANSWER_SCHEMA, z.null()])).max(5);

function getStudyTopicLabel(questions: unknown): string | undefined {
  if (!Array.isArray(questions) || questions.length === 0) return undefined;
  const first = questions[0];
  if (!first || typeof first !== "object") return undefined;
  const row = first as Record<string, unknown>;
  if (typeof row.topicTitle !== "string" || !row.topicTitle.trim()) return undefined;
  if (
    typeof row.topicWeek === "number" && Number.isInteger(row.topicWeek) &&
    typeof row.topicDay === "number" && Number.isInteger(row.topicDay)
  ) {
    return "Week " + row.topicWeek + " · Day " + row.topicDay + " — " + row.topicTitle;
  }
  return row.topicTitle;
}

function parseDateParam(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s) return null;
  return date;
}

type CompletedTopic = { week: number; day: number };

function resolveAssessmentTopic(
  week: number,
  day: number,
  outline: Awaited<ReturnType<typeof getCourseOutline>>,
) {
  if (outline) {
    const topic = topicInOutline(outline, week, day);
    if (!topic) return null;
    return {
      week,
      day,
      title: topic.title,
      objective: topic.objective,
      activity: topic.activity ?? undefined,
      deliverable: topic.deliverable ?? undefined,
      resources: [] as { label: string; url: string }[],
    };
  }

  const topic = getTopicByWeekDay(week, day);
  if (!topic) return null;
  return { week, day, ...topic };
}

export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return apiError("AI assessment is disabled or temporarily unavailable.", ErrorCode.FORBIDDEN, 403);
  }

  const { date: dateStr } = await ctx.params;
  const date = parseDateParam(dateStr);
  if (!date) return apiValidationError({ date: "date must be YYYY-MM-DD" });

  let body: { courseId?: string } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  const courseId = body.courseId;
  if (!courseId) return apiValidationError({ courseId: "courseId is required" });

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiNotFound("Course not found");

  const enrollment = await db.courseEnrollment.findFirst({
    where: { userId: user.sub, courseId, role: "student" },
    select: { id: true },
  });
  if (!enrollment) return apiError("You are not enrolled in this course", ErrorCode.FORBIDDEN, 403);

  await getOrCreateProfile(user.sub, courseId);

  // Idempotent — if test exists, return it.
  const existing = await db.learnDailyTest.findUnique({
    where: { userId_courseId_date: { userId: user.sub, courseId, date } },
  });
  if (existing) {
    const existingQuestions = QUESTION_SCHEMA.safeParse(existing.questions);
    const existingAnswers = STORED_ANSWERS_SCHEMA.safeParse(existing.answers ?? []);
    if (
      !existingQuestions.success ||
      !existingAnswers.success ||
      (existing.status !== "in_progress" && existing.status !== "completed") ||
      (existing.status === "completed" && (
        existingAnswers.data.length !== existingQuestions.data.length ||
        existingAnswers.data.some((answer) => answer === null)
      ))
    ) {
      return apiDegraded("This saved daily test has incomplete or invalid evidence. No result was changed.");
    }

    return apiSuccess({
      testId: existing.id,
      questions: existing.questions,
      status: existing.status,
      answers: existingAnswers.data,
      studyTopicLabel: getStudyTopicLabel(existing.questions),
    });
  }

  // A daily test follows a completed study topic. The completion endpoint
  // writes this history before advancing LearnProfile to the next topic.
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
  });
  const topicProgress = (profile?.masteryMap as {
    topicProgress?: { history?: unknown };
  } | null)?.topicProgress;
  const history = Array.isArray(topicProgress?.history)
    ? topicProgress.history.filter((entry): entry is CompletedTopic => {
        if (!entry || typeof entry !== "object") return false;
        const value = entry as Record<string, unknown>;
        return Number.isInteger(value.week) && Number.isInteger(value.day)
          && Number(value.week) >= 1 && Number(value.day) >= 1;
      })
    : [];

  const latestCompleted = history.at(-1);
  if (!latestCompleted) {
    return apiError(
      "Complete a study topic before starting its daily test.",
      ErrorCode.OUT_OF_SEQUENCE,
      409,
    );
  }

  let outline: Awaited<ReturnType<typeof getCourseOutline>>;
  try {
    outline = await getCourseOutline(courseId);
  } catch (error) {
    logger.error("Daily test course outline lookup failed", {
      courseId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return apiError(
      "Course content is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  const studyTopic = resolveAssessmentTopic(latestCompleted.week, latestCompleted.day, outline);
  if (!studyTopic) {
    return apiError(
      "The completed study topic is no longer available in this course outline.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  // Spaced repetition draws only from topics completed before this session.
  const priorHistory = history.slice(0, -1);
  let srTopic: ReturnType<typeof resolveAssessmentTopic> = null;
  if (priorHistory.length > 0) {
    const pick = priorHistory[Math.floor(Math.random() * priorHistory.length)];
    srTopic = resolveAssessmentTopic(pick.week, pick.day, outline);
  }

  // Question difficulty ADAPTS TO THE LEARNER (2026-09): the level comes
  // from this learner's own recent daily/weekly test scores for THIS
  // course — never from the calendar. Weeks/days are a management
  // structure; the learner sets the pace, difficulty follows the learner.
  const difficulty = await getLearnerDifficulty(user.sub, courseId);

  const systemPrompt = [
    "You are an expert AI tutor on the TraineesAI Learn platform. Generate a short daily test that CHECKS UNDERSTANDING and TEACHES through the questions themselves.",
    "The JSON must conform to this schema.",
    "Rules:",
    " - Exactly 3 questions.",
    " - Questions 1 and 2 cover most recently COMPLETED study topic. Question 3 is a spaced-repetition question on a PAST topic.",
    " - 'open' = one-sentence answer, 'short' = a few words, 'probe' = a Socratic follow-up.",
    " - Ask WHY / HOW / WHAT-IF questions that probe real understanding and application — never bare definitions or yes/no recall.",
    ` - Difficulty is calibrated to THIS learner's level: ${difficulty.level}/5 (${difficulty.label}). ${difficulty.directive}`,
    " - Ramp gently across the test: Q1 the easiest within that band, Q3 the hardest.",
    " - Anchor each question in a concrete engineering situation when possible (the learner is an internee on the job).",
    " - conceptId = 'today' for Q1+Q2, 'sr' for Q3.",
    " - isSpacedRepetition = false for Q1+Q2, true for Q3.",
    " - No prose outside the JSON.",
  ].join("\n");

  const userPrompt = [
    `Learner difficulty level: ${difficulty.level}/5 (${difficulty.label}) — from this learner's recent test performance in this course.`,
    `Most recently completed study topic (Q1+Q2):`,
    `Week ${studyTopic.week} Day ${studyTopic.day}: ${studyTopic.title}`,
    `Objective: ${studyTopic.objective}`,
    studyTopic.whyItMatters ? `Why it matters: ${studyTopic.whyItMatters}` : "",
    studyTopic.activity ? `Planned activity: ${studyTopic.activity}` : "",
    studyTopic.deliverable ? `Deliverable: ${studyTopic.deliverable}` : "",
    ``,
    srTopic
      ? `Earlier completed study topic (Q3): ${srTopic.title} — ${srTopic.objective}`
      : `Earlier completed topic: none available yet — make all questions on the most recently completed study topic and do not mark any question as spaced repetition.`,
  ].filter(Boolean).join("\n");

  const result = await callAIJson<z.infer<typeof GENERATED_QUESTION_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: GENERATED_QUESTION_SCHEMA,
      feature: "learn-daily-test-start",
      userId: user.sub,
      temperature: 0.5,
      // DeepSeek V4 reasons before answering — a tight cap empties
      // `content` and silently degrades to canned questions. 900 leaves
      // room for reasoning + 3 teaching-quality questions + valid JSON.
      maxTokens: 900,
      // Question generation recurs for every learner hitting the same
      // (course, day, DIFFICULTY LEVEL) — the difficulty directive is
      // part of the prompt, so the token-cache key shards per level and
      // same-level learners still share one cached generation. Grading
      // is per-student and stays uncached.
      cacheable: true,
      cacheTtlMs: 6 * 60 * 60 * 1000,
    },
  );

  let questions;
  const aiFallback = !result.ok;
  if (result.ok) {
    questions = result.data;
  } else {
    logger.warn("learn daily-test AI failed, using fallback", { error: result.error });
    questions = [
      { question: `In one sentence: what is ${studyTopic.title}?`, format: "open" as const, conceptId: "today", isSpacedRepetition: false },
      { question: `Give one concrete example of: ${studyTopic.title}.`, format: "short" as const, conceptId: "today", isSpacedRepetition: false },
      srTopic
        ? { question: `Recall: ${srTopic.title} — explain it in one sentence.`, format: "open" as const, conceptId: "sr", isSpacedRepetition: true }
        : { question: `Why does ${studyTopic.title} matter in a real project?`, format: "open" as const, conceptId: "today", isSpacedRepetition: false },
    ];
  }

  // Attach per-question topic context so the answer route can TEACH the
  // right content without re-deriving the learner's position later
  // (midnight rollover would otherwise point the grader at the wrong
  // topic). Spaced-repetition questions carry their own past topic.
  // difficultyLevel/Label ride on every question (additive JSON) so a
  // resumed test still shows its band without a schema migration.
  questions = questions.map((q) => {
    const topic = q.conceptId === "sr" && srTopic ? srTopic : studyTopic;
    return {
      ...q,
      topicTitle: topic.title,
      topicObjective: topic.objective,
      difficultyLevel: difficulty.level,
      difficultyLabel: difficulty.label,
      topicWeek: topic.week,
      topicDay: topic.day,
      generationFallback: aiFallback,
    };
  });

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

  return apiSuccess({
    testId: test.id,
    questions,
    status: "in_progress",
    answers: [],
    difficulty: { level: difficulty.level, label: difficulty.label },
    aiFallback,
    studyTopicLabel: "Week " + studyTopic.week + " · Day " + studyTopic.day + " — " + studyTopic.title,
  });
}
