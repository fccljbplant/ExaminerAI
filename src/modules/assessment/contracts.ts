/**
 * modules/assessment/contracts.ts — W5 exam-runner contracts (REDESIGN-P4 §2 L8–L10)
 *
 * Shared zod schemas + slug helpers for the exam runner API. Routes
 * validate with these; the client parses responses with the same shapes.
 *
 * Exam identity: an opaque URL-safe slug encodes kind + course + date/week:
 *   daily-<courseId>-<YYYY-MM-DD>   (the learner's daily check-in)
 *   weekly-<courseId>-<week>        (the week's assessment)
 * The slug is the [id] path param of /api/v2/exams/[id]/…
 */

import { z } from "zod";

export type ExamKind = "daily" | "weekly";

// ── Slug helpers (pure) ────────────────────────────────────────────────

export function examSlug(
  kind: ExamKind,
  courseId: string,
  dateOrWeek: Date | number,
): string {
  if (kind === "daily") {
    const d = dateOrWeek instanceof Date ? dateOrWeek : new Date(dateOrWeek);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `daily-${courseId}-${y}-${m}-${day}`;
  }
  return `weekly-${courseId}-${Number(dateOrWeek)}`;
}

export interface ParsedExamSlug {
  kind: ExamKind;
  courseId: string;
  /** daily only */
  date?: Date;
  /** weekly only */
  week?: number;
}

/** Parse a slug back into its parts. Returns null for malformed input. */
export function parseExamSlug(slug: string): ParsedExamSlug | null {
  const daily = /^daily-(.+)-(\d{4})-(\d{2})-(\d{2})$/.exec(slug);
  if (daily) {
    const [, courseId, y, m, d] = daily;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return { kind: "daily", courseId, date };
  }
  const weekly = /^weekly-(.+)-(\d+)$/.exec(slug);
  if (weekly) {
    const [, courseId, w] = weekly;
    return { kind: "weekly", courseId, week: Number(w) };
  }
  return null;
}

// ── Question shape (mirrors LearnDailyTest/LearnWeeklyTest JSON) ───────

export const ExamQuestionSchema = z.object({
  question: z.string().min(1),
  format: z.enum(["open", "short", "probe"]).default("open"),
  conceptId: z.string().default(""),
  isSpacedRepetition: z.boolean().default(false),
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const ExamQuestionsSchema = z.array(ExamQuestionSchema).min(1).max(20);

// ── Graded answer record (stored in ExamSession.answersJson) ───────────

export const ExamAnswerRecordSchema = z.object({
  index: z.number().int().min(0),
  question: z.string(),
  format: z.string(),
  answer: z.string(),
  /** 0–100 per-question grade (gradeOneQuestion). */
  score: z.number().min(0).max(100),
  explanation: z.string(),
  correctAnswer: z.string(),
  flagged: z.boolean().default(false),
});
export type ExamAnswerRecord = z.infer<typeof ExamAnswerRecordSchema>;

// ── API bodies ─────────────────────────────────────────────────────────

/** PATCH /v2/exams/[id]/answer — autosave one question's draft + grade. */
export const ExamAnswerInputSchema = z.object({
  index: z.number().int().min(0).max(49),
  answer: z.string().max(10_000),
  flagged: z.boolean().optional(),
});
export type ExamAnswerInput = z.infer<typeof ExamAnswerInputSchema>;

/** Shared session view (start/resume/results all return a slice of it). */
export const ExamSessionViewSchema = z.object({
  slug: z.string(),
  kind: z.enum(["daily", "weekly"]),
  courseId: z.string(),
  courseName: z.string().nullable(),
  status: z.string(),
  questionIndex: z.number().int(),
  total: z.number().int(),
  score: z.number().nullable(),
  questions: z.array(ExamQuestionSchema),
  answers: z.array(ExamAnswerRecordSchema),
  xpAwarded: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ExamSessionView = z.infer<typeof ExamSessionViewSchema>;
