// src/modules/learn/lib/learner-difficulty.ts — Question difficulty adapts
// to the LEARNER's demonstrated level (2026-09).
/**
 * Question-difficulty adaptation for the Learn tests (daily + weekly).
 *
 * The AI does the processing — this module only decides WHICH band to ask
 * the generation prompt to target, from evidence the platform already has:
 * the learner's own recent daily/weekly test scores for THIS course.
 *
 * Model (user requirement 2026-09):
 *   - Weeks/days are a MANAGEMENT structure; the learner sets the pace
 *     (three days' topics in one day is fine). Difficulty follows the
 *     LEARNER, never the calendar.
 *   - Level is 1-5 on the same vocabulary as the legacy adaptive engine
 *     (src/lib/assessment/adaptive.ts): Warm-up / Core / Stretch /
 *     Advanced / Expert.
 *   - Every directive is application-first (WHY / HOW / WHAT-IF) — the
 *     daily/weekly prompts forbid bare definitions at EVERY level, so a
 *     low level means gentler scenarios and more scaffolding, never
 *     trivia recall.
 *
 * Token-cache interaction: the directive is part of the generation
 * prompt, so the cache key (sha256 of messages) shards naturally per
 * (course, day/week, difficulty level). Learners at the same level still
 * share one cached generation — no extra token spend for the common case.
 */

import { db } from "@/lib/db";
import { levelLabel } from "@/lib/assessment/adaptive";

/** Number of recent completed tests considered (newest last). */
export const DIFFICULTY_WINDOW = 8;

/** Weekly tests count double: 10 questions is a bigger signal than 3. */
export const WEEKLY_WEIGHT = 2;

export interface LearnerDifficulty {
  /** 1..5 — same scale as src/lib/assessment/adaptive.ts */
  level: number;
  /** Human label ("Warm-up" .. "Expert") — safe to show in the UI. */
  label: string;
  /** Directive injected into the question-generation system prompt. */
  directive: string;
  /** Normalized 0..1 scores used, oldest first (diagnostics/tests). */
  recentScores: number[];
}

/** Learn-flavored per-level directives. Application-first at every level. */
export const LEARN_DIFFICULTY_DIRECTIVES: string[] = [
  // 1 — Warm-up: gentle, heavily scaffolded, still WHY/HOW.
  "Ask gentle, high-scaffold questions: a short familiar scenario and plain language, with one clear step of reasoning. Build confidence while still asking WHY or HOW — never bare definitions or yes/no recall.",
  // 2 — Core: standard understanding check.
  "Ask standard questions: a realistic work situation where the learner explains HOW or WHY the idea works, in their own words.",
  // 3 — Stretch: transfer to unfamiliar ground.
  "Ask stretch questions: apply the idea to an unfamiliar situation, compare two options, or explain a trade-off.",
  // 4 — Advanced: diagnosis and justification.
  "Ask advanced questions: diagnosis, failure modes, edge cases, or justifying a design decision under real constraints.",
  // 5 — Expert: synthesis under competing constraints.
  "Ask expert questions: combine several concepts from the recent topics into one scenario with competing constraints; expect reasoning about trade-offs and second-order effects.",
];

/** Normalize a stored final score to 0..1 using the test's question count. */
export function normalizeScore(score: number, questionCount: number): number {
  if (!Number.isFinite(score) || questionCount <= 0) return 0;
  return Math.max(0, Math.min(1, score / questionCount));
}

/**
 * Map a normalized 0..1 average to a difficulty band 1..5.
 * Pure — unit-tested. Bands are deliberately wide so single fluke
 * answers don't whipsaw the level.
 */
export function levelFromAverage(avg: number): number {
  if (avg >= 0.85) return 5;
  if (avg >= 0.7) return 4;
  if (avg >= 0.55) return 3;
  if (avg >= 0.4) return 2;
  return 1;
}

/**
 * Recency-weighted mean over (score, weight) pairs, oldest first.
 * Linear recency weights (oldest = 1 ... newest = N) multiplied by the
 * per-entry kind weight (weekly tests count double).
 */
export function weightedAverage(entries: { score: number; weight: number }[]): number {
  if (entries.length === 0) return 0;
  let sum = 0;
  let weightSum = 0;
  for (const [i, e] of entries.entries()) {
    const w = (i + 1) * Math.max(1, e.weight); // recency × kind weight
    sum += e.score * w;
    weightSum += w;
  }
  return weightSum > 0 ? sum / weightSum : 0;
}

/**
 * Derive the learner's current question-difficulty level for a course.
 * Never throws — any failure degrades to the Core band (level 2).
 */
export async function getLearnerDifficulty(
  userId: string,
  courseId: string,
): Promise<LearnerDifficulty> {
  try {
    const [daily, weekly] = await Promise.all([
      db.learnDailyTest.findMany({
        where: { userId, courseId, status: "completed" },
        orderBy: { date: "desc" },
        take: DIFFICULTY_WINDOW,
        select: { score: true, questions: true, date: true },
      }),
      db.learnWeeklyTest.findMany({
        where: { userId, courseId, status: "completed" },
        orderBy: { completedAt: "desc" },
        take: DIFFICULTY_WINDOW,
        select: { score: true, questions: true, completedAt: true },
      }),
    ]);

    // Merge with real timestamps, normalize each score to 0..1, weight
    // weekly tests ×2 (10 questions is a bigger signal than 3).
    const entries: { score: number; weight: number; at: number }[] = [];
    for (const t of daily) {
      const count = Array.isArray(t.questions) ? t.questions.length : 3;
      entries.push({
        score: normalizeScore(Number(t.score ?? 0), count),
        weight: 1,
        at: t.date ? new Date(t.date).getTime() : 0,
      });
    }
    for (const t of weekly) {
      const count = Array.isArray(t.questions) ? t.questions.length : 10;
      entries.push({
        score: normalizeScore(Number(t.score ?? 0), count),
        weight: WEEKLY_WEIGHT,
        at: t.completedAt ? new Date(t.completedAt).getTime() : 0,
      });
    }

    // Cold start (no completed tests yet): Core — kind, but not trivia.
    if (entries.length === 0) {
      return { level: 2, label: levelLabel(2), directive: LEARN_DIFFICULTY_DIRECTIVES[1], recentScores: [] };
    }

    // Oldest → newest, keep the most recent DIFFICULTY_WINDOW signals.
    entries.sort((a, b) => a.at - b.at);
    const window = entries.slice(-DIFFICULTY_WINDOW);

    const level = levelFromAverage(weightedAverage(window));
    return {
      level,
      label: levelLabel(level),
      directive: LEARN_DIFFICULTY_DIRECTIVES[level - 1],
      recentScores: window.map((e) => Math.round(e.score * 100) / 100),
    };
  } catch {
    // DB hiccup must never block a test from starting.
    return { level: 2, label: levelLabel(2), directive: LEARN_DIFFICULTY_DIRECTIVES[1], recentScores: [] };
  }
}
