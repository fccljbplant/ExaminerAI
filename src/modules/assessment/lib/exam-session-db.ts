/**
 * modules/assessment/lib/exam-session-db.ts — W5 exam-runner DB wrapper
 * (REDESIGN-P4 §2 L9/L10)
 *
 * The ONLY file in the exam-runner subsystem that imports `db`. Pure
 * state transitions live in exam-session.ts; this file orchestrates
 * them with persistence: start (lazy question generation for weekly,
 * existing LearnDailyTest rows for daily), autosave-answer (graded via
 * gradeOneQuestion), complete (score + XP + notification), results.
 *
 * Access model (IDOR guard): every function takes the owning userId and
 * scopes the session lookup to it.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
// Server-only learn helpers (assessment is a server module — no client
// bundling concern, so the barrel is safe here).
import { awardTypedXP, getOrCreateProfile, getTodayTopic, getTopicByWeekDay } from "@/modules/learn";
import { callAIJson } from "./ai-json";
import { gradeOneQuestion } from "./unified-test-engine";
import { pseudonym } from "@/modules/ai";
import {
  examSlug,
  parseExamSlug,
  ExamAnswerInputSchema,
  ExamQuestionsSchema,
  type ExamAnswerRecord,
  type ExamKind,
  type ExamQuestion,
  type ExamSessionView,
  type ParsedExamSlug,
} from "../contracts";
import {
  completionCheck,
  computeScore,
  examKindLabel,
  examXpReason,
  upsertAnswer,
} from "./exam-session";

// ── Errors (routes map to the v2 envelope) ─────────────────────────────

export class ExamError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ExamError";
  }
}

// ── Question generation (lazy; mirrors the learn daily-test route) ─────

const WEEKLY_SCHEMA = z
  .array(
    z.object({
      question: z.string().min(1),
      format: z.enum(["open", "short", "probe"]).default("open"),
      conceptId: z.string().default(""),
      isSpacedRepetition: z.boolean().default(false),
    }),
  )
  .min(5)
  .max(12);

/** Daily: reuse the learner's existing LearnDailyTest row, else generate
 *  3 questions (2 today + 1 spaced repetition) exactly like the learn
 *  flow so the two surfaces never disagree. */
async function ensureDailyQuestions(
  userId: string,
  courseId: string,
  date: Date,
): Promise<ExamQuestion[]> {
  const existing = await db.learnDailyTest.findUnique({
    where: { userId_courseId_date: { userId, courseId, date } },
    select: { questions: true },
  });
  if (existing) return ExamQuestionsSchema.parse(existing.questions);

  // Mirror the learn flow: ensure the profile exists before reading the
  // topic position (new enrollees have no LearnProfile row yet).
  await getOrCreateProfile(userId, courseId);
  const today = await getTodayTopic(userId, courseId);
  if (!today) {
    throw new ExamError("Course is complete — no topic to test on", "NOT_FOUND", 404);
  }

  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { masteryMap: true },
  });
  const mastery = (profile?.masteryMap as { topicProgress?: { history?: { week: number; day: number }[] } } | null) ?? {};
  const history = mastery.topicProgress?.history ?? [];
  let srTopic: { title: string; objective: string } | null = null;
  if (history.length > 0) {
    const pick = history[Math.floor(Math.random() * history.length)];
    srTopic = getTopicByWeekDay(pick.week, pick.day) ?? null;
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
    "",
    srTopic
      ? `Spaced-repetition topic (Q3): ${srTopic.title} — ${srTopic.objective}`
      : `Spaced-repetition topic: none available yet — make all 3 questions on today's topic, but mark Q3's isSpacedRepetition=false and conceptId='today'.`,
  ].join("\n");

  const result = await callAIJson<z.infer<typeof ExamQuestionsSchema>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: ExamQuestionsSchema,
      feature: "learn-daily-test-start",
      userId,
      temperature: 0.5,
      maxTokens: 500,
    },
  );

  let questions: ExamQuestion[];
  if (result.ok) {
    questions = result.data;
  } else {
    logger.warn("exam daily generation failed, using fallback", { error: result.error });
    questions = [
      { question: `In one sentence: what is ${today.topic.title}?`, format: "open", conceptId: "today", isSpacedRepetition: false },
      { question: `Give one concrete example of: ${today.topic.title}.`, format: "short", conceptId: "today", isSpacedRepetition: false },
      srTopic
        ? { question: `Recall: ${srTopic.title} — explain it in one sentence.`, format: "open", conceptId: "sr", isSpacedRepetition: true }
        : { question: `What part of ${today.topic.title} did you find most useful?`, format: "probe", conceptId: "today", isSpacedRepetition: false },
    ];
  }

  await db.learnDailyTest.create({
    data: {
      userId,
      courseId,
      date,
      questions,
      status: "in_progress",
    },
  });
  return questions;
}

/** Weekly: rows are lazily created (the model is read-only today) — a
 *  10-question bank spanning the learner's journey so far. */
async function ensureWeeklyQuestions(
  userId: string,
  courseId: string,
  week: number,
): Promise<ExamQuestion[]> {
  const existing = await db.learnWeeklyTest.findUnique({
    where: { userId_courseId_week: { userId, courseId, week } },
    select: { questions: true },
  });
  if (existing) return ExamQuestionsSchema.parse(existing.questions);

  const course = await db.course.findUnique({ where: { id: courseId }, select: { name: true, description: true } });
  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform. Generate a weekly test.",
    "Respond with ONLY a JSON array. No prose, no markdown fences.",
    "Each item: { question: string, format: 'open'|'short'|'probe', conceptId: string, isSpacedRepetition: boolean }.",
    "Rules:",
    " - Exactly 10 questions.",
    " - Mix formats: ~4 'open', ~4 'short', ~2 'probe'.",
    " - Cover the first " + Math.max(week, 1) + " week(s) of the course progressively: fundamentals first, later weeks build on them.",
    " - 'open' = one-sentence answer, 'short' = a few words, 'probe' = a Socratic follow-up.",
  ].join("\n");

  const result = await callAIJson<z.infer<typeof WEEKLY_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Course: ${course?.name ?? "the course"}\n${course?.description ?? ""}\nGenerate the ${week}-week weekly test now.`,
      },
    ],
    {
      schema: WEEKLY_SCHEMA,
      feature: "learn-weekly-test-start",
      userId,
      temperature: 0.5,
      maxTokens: 900,
    },
  );

  let questions: ExamQuestion[];
  if (result.ok) {
    questions = result.data.slice(0, 10);
  } else {
    logger.warn("exam weekly generation failed, using fallback", { error: result.error });
    questions = Array.from({ length: 10 }, (_, i) => ({
      question: `Week ${Math.min(week, i + 1)} review question ${i + 1}: summarise the key idea from this week in one sentence.`,
      format: "open" as const,
      conceptId: `week${Math.min(week, i + 1)}`,
      isSpacedRepetition: false,
    }));
  }

  await db.learnWeeklyTest.create({
    data: { userId, courseId, week, questions, status: "in_progress" },
  });
  return questions;
}

// ── Session loading + view assembly ─────────────────────────────────────

/** Load a session by its row id OR its URL slug (the [id] path param is
 *  the slug everywhere in the API — start/resume/answer/complete/results). */
async function loadExamBundle(userId: string, sessionId: string) {
  const session = await db.examSession.findFirst({
    where: { userId, OR: [{ id: sessionId }, { slug: sessionId }] }, // IDOR: owner-scoped
    include: { course: { select: { name: true } } },
  });
  if (!session) throw new ExamError("Exam session not found", "NOT_FOUND", 404);
  return session;
}

/** Load the Learn row that owns the questions for a session. */
async function loadQuestions(session: {
  userId: string;
  courseId: string;
  kind: string;
  slug: string;
}): Promise<ExamQuestion[]> {
  const parsed = parseExamSlug(session.slug);
  if (!parsed) throw new ExamError("Corrupt exam slug", "CONFLICT", 500);
  if (session.kind === "daily" && parsed.date) {
    const row = await db.learnDailyTest.findUnique({
      where: { userId_courseId_date: { userId: session.userId, courseId: session.courseId, date: parsed.date } },
      select: { questions: true },
    });
    if (!row) throw new ExamError("Test questions missing — start the exam again", "NOT_FOUND", 404);
    return ExamQuestionsSchema.parse(row.questions);
  }
  if (session.kind === "weekly" && parsed.week != null) {
    const row = await db.learnWeeklyTest.findUnique({
      where: { userId_courseId_week: { userId: session.userId, courseId: session.courseId, week: parsed.week } },
      select: { questions: true },
    });
    if (!row) throw new ExamError("Test questions missing — start the exam again", "NOT_FOUND", 404);
    return ExamQuestionsSchema.parse(row.questions);
  }
  throw new ExamError("Unsupported exam kind", "VALIDATION", 400);
}

function parseAnswers(json: unknown): ExamAnswerRecord[] {
  if (!Array.isArray(json)) return [];
  return json.filter((a): a is ExamAnswerRecord => {
    if (typeof a !== "object" || a === null) return false;
    const r = a as Record<string, unknown>;
    return typeof r.index === "number" && typeof r.answer === "string";
  });
}

function toView(
  session: {
    slug: string;
    kind: string;
    courseId: string;
    status: string;
    questionIndex: number;
    answersJson: unknown;
    score: number | null;
    xpAwarded: number;
    startedAt: Date;
    completedAt: Date | null;
  },
  questions: ExamQuestion[],
  courseName: string | null,
): ExamSessionView {
  const answers = parseAnswers(session.answersJson);
  return {
    slug: session.slug,
    kind: session.kind as ExamKind,
    courseId: session.courseId,
    courseName,
    status: session.status,
    questionIndex: session.questionIndex,
    total: questions.length,
    score: session.score,
    questions,
    answers,
    xpAwarded: session.xpAwarded,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  };
}

// ── Core operations ─────────────────────────────────────────────────────

/** Start (or resume) an exam. Daily reuses LearnDailyTest rows; weekly
 *  generates the question bank lazily on first start. Idempotent. */
export async function getOrStartExam(
  userId: string,
  kind: ExamKind,
  courseId: string,
  date?: Date,
  week?: number,
): Promise<ExamSessionView> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { name: true },
  });
  if (!course) throw new ExamError("Course not found", "NOT_FOUND", 404);

  const questions =
    kind === "daily"
      ? await ensureDailyQuestions(userId, courseId, date ?? new Date())
      : await ensureWeeklyQuestions(userId, courseId, week ?? 1);

  const slug = examSlug(kind, courseId, kind === "daily" ? (date ?? new Date()) : (week ?? 1));
  const session = await db.examSession.upsert({
    where: { userId_courseId_kind_slug: { userId, courseId, kind, slug } },
    create: {
      userId,
      courseId,
      kind,
      slug,
      questionIndex: 0,
      answersJson: [],
      status: "in_progress",
    },
    update: {},
  });

  return toView(session, questions, course.name);
}

/** Autosave + grade one answer. Idempotent per index (debounced PATCHes
 *  re-save safely). Never cached. */
export async function saveExamAnswer(
  userId: string,
  sessionId: string,
  input: z.infer<typeof ExamAnswerInputSchema>,
  studentName: string,
): Promise<{ saved: boolean; index: number; questionIndex: number }> {
  const session = await loadExamBundle(userId, sessionId);
  if (session.status !== "in_progress") {
    throw new ExamError("This exam is already completed", "CONFLICT", 409);
  }

  const questions = await loadQuestions(session);
  if (input.index >= questions.length) {
    throw new ExamError("Question index out of range", "VALIDATION", 400);
  }
  const question = questions[input.index];

  const grade = await gradeOneQuestion({
    question: question.question,
    studentAnswers: [input.answer],
    topic: session.course.name ?? "the course",
    testKind: session.kind === "daily" ? "daily_test" : "weekly_test",
    // Privacy (2026-08-15): the AI grades a pseudonym, never the name.
    studentName: pseudonym(userId),
  });

  const answers = upsertAnswer(parseAnswers(session.answersJson), input, question.question, question.format, {
    score: grade.score,
    explanation: grade.explanation,
    correctAnswer: grade.correctAnswer,
  });

  // The runner's pointer only ever moves forward (resume-safe).
  const questionIndex = Math.max(session.questionIndex, input.index + 1);

  await db.examSession.update({
    where: { id: session.id },
    data: {
      answersJson: answers as unknown as Prisma.InputJsonValue,
      questionIndex,
    },
  });

  return { saved: true, index: input.index, questionIndex };
}

/** Complete the exam: score, XP award, notification. All questions must
 *  be answered (the runner enforces this too). */
export async function completeExam(userId: string, sessionId: string): Promise<ExamSessionView> {
  const session = await loadExamBundle(userId, sessionId);
  if (session.status !== "in_progress") {
    throw new ExamError("This exam is already completed", "CONFLICT", 409);
  }

  const questions = await loadQuestions(session);
  const answers = parseAnswers(session.answersJson);
  const check = completionCheck(answers, questions.length);
  if (!check.ok) {
    throw new ExamError(
      `Answer all questions first (${check.missing} remaining).`,
      "VALIDATION",
      400,
    );
  }

  const score = computeScore(answers, questions.length);

  // XP + notification, best-effort: grading already happened per answer.
  let xpAwarded = 0;
  try {
    xpAwarded = await awardTypedXP(userId, examXpReason(session.kind as ExamKind), session.courseId, `exam:${session.id}`);
  } catch (err) {
    logger.warn("exam XP award failed", { error: err instanceof Error ? err.message : String(err) });
  }

  await db.notification.create({
    data: {
      userId,
      type: "test_result",
      title: `${examKindLabel(session.kind as ExamKind)} graded`,
      body: `You scored ${Math.round(score)}%${
        score >= 60 ? " — nice work." : " — review the explanations to level up."
      }`,
      link: `/learner/exams/${session.slug}/results`,
    },
  });

  await db.examSession.update({
    where: { id: session.id },
    data: { status: "completed", score, xpAwarded, completedAt: new Date() },
  });

  // Keep the underlying Learn row consistent — the legacy classroom flow
  // reads its status/score (strangulation: both surfaces agree).
  const parsed = parseExamSlug(session.slug);
  const roundScore = Math.round(score);
  if (parsed?.kind === "daily" && parsed.date) {
    await db.learnDailyTest.updateMany({
      where: { userId, courseId: session.courseId, date: parsed.date },
      data: { status: "completed", score: roundScore, completedAt: new Date() },
    });
  } else if (parsed?.kind === "weekly" && parsed.week != null) {
    await db.learnWeeklyTest.updateMany({
      where: { userId, courseId: session.courseId, week: parsed.week },
      data: { status: "completed", score: roundScore, completedAt: new Date() },
    });
  }

  return toView(
    { ...session, status: "completed", score, xpAwarded, completedAt: new Date() },
    questions,
    session.course.name,
  );
}

/** Results / resume view — works for both statuses (the client renders
 *  the runner when in_progress, results when completed). */
export async function getExamView(userId: string, sessionId: string): Promise<ExamSessionView> {
  const session = await loadExamBundle(userId, sessionId);
  const questions = await loadQuestions(session);
  return toView(session, questions, session.course.name);
}

/** Resolve the slug for a (kind, courseId, date|week) tuple — used by the
 *  exams list to build Resume/Review links. */
export function buildExamSlug(kind: ExamKind, courseId: string, date?: Date | null, week?: number | null): string {
  return examSlug(kind, courseId, kind === "daily" ? (date ?? new Date()) : (week ?? 1));
}

export type { ParsedExamSlug };
