/**
 * modules/assessment/lib/exam-session.ts — W5 pure exam-session state machine
 * (REDESIGN-P4 §2 L9/L10)
 *
 * Pure functions over the ExamSession answer array + question index:
 * grading application, score computation, resume view assembly, and
 * completion guards. No db, no React, no AI — testable in isolation.
 * The DB wrapper (exam-session-db.ts) is the only file that persists.
 */

import type { ExamAnswerInput, ExamAnswerRecord, ExamKind } from "../contracts";

// ── Answer application ─────────────────────────────────────────────────

export interface AnswerGrade {
  score: number;
  explanation: string;
  correctAnswer: string;
}

/**
 * Apply one autosaved answer: replaces any prior record at the same
 * index (idempotent re-save — the runner debounces PATCHes) and keeps
 * the array ordered by index. `flagged` from an earlier save survives
 * when the new input omits it.
 */
export function upsertAnswer(
  answers: ExamAnswerRecord[],
  input: ExamAnswerInput,
  question: string,
  format: string,
  grade: AnswerGrade,
): ExamAnswerRecord[] {
  const record: ExamAnswerRecord = {
    index: input.index,
    question,
    format,
    answer: input.answer,
    score: grade.score,
    explanation: grade.explanation,
    correctAnswer: grade.correctAnswer,
    flagged: input.flagged ?? answers.find((a) => a.index === input.index)?.flagged ?? false,
  };
  const rest = answers.filter((a) => a.index !== input.index);
  return [...rest, record].sort((a, b) => a.index - b.index);
}

// ── Score ──────────────────────────────────────────────────────────────

/**
 * Overall score = mean of every question's grade, unanswered counting 0
 * (fair and deterministic: a skipped question can't inflate the score).
 */
export function computeScore(answers: ExamAnswerRecord[], total: number): number {
  if (total <= 0) return 0;
  const sum = answers.reduce((s, a) => s + a.score, 0);
  return Math.round((sum / total) * 100) / 100;
}

/** Pass threshold used by the results screen. */
export const EXAM_PASS_SCORE = 60;

export function isPass(score: number | null): boolean {
  return score !== null && score >= EXAM_PASS_SCORE;
}

// ── Progress / resume ──────────────────────────────────────────────────

/** The next question the runner should show. Never exceeds the bank. */
export function nextIndex(
  questionIndex: number,
  answers: ExamAnswerRecord[],
  total: number,
): number {
  if (questionIndex < total && answers.some((a) => a.index === questionIndex)) {
    // Current question already answered (resume after autosave) — advance.
    return Math.min(questionIndex + 1, total - 1);
  }
  return Math.min(questionIndex, total - 1);
}

/** Count of graded questions — the runner's progress numerator. */
export function answeredCount(answers: ExamAnswerRecord[], total: number): number {
  return Math.min(answers.length, total);
}

// ── Completion guards ──────────────────────────────────────────────────

export interface CompletionCheck {
  ok: boolean;
  /** When false: how many questions are still unanswered. */
  missing: number;
}

export function completionCheck(
  answers: ExamAnswerRecord[],
  total: number,
): CompletionCheck {
  const answered = new Set(answers.map((a) => a.index));
  const missing = Array.from({ length: total }, (_, i) => i).filter(
    (i) => !answered.has(i),
  ).length;
  return { ok: missing === 0, missing };
}

// ── Kind helpers ───────────────────────────────────────────────────────

/** The learner-facing label for an exam kind. */
export function examKindLabel(kind: ExamKind): string {
  return kind === "daily" ? "Daily check-in" : "Weekly test";
}

/** XP reason per kind (matches modules/learn XP_AMOUNTS). */
export function examXpReason(kind: ExamKind): "daily_test_done" | "weekly_test_done" {
  return kind === "daily" ? "daily_test_done" : "weekly_test_done";
}
