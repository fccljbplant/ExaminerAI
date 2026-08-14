/**
 * modules/learn/contracts.ts — W3 Zod contracts
 *
 * Shared request/response schemas for the study-flow v2 API.
 * Routes import these for input validation; client code can import
 * them for type-safe response parsing.
 */

import { z } from "zod";

// ── Study Plan ───────────────────────────────────────────────────────────

/** courseId is optional — when omitted the server resolves the learner's
 *  primary (most recently active) enrollment. */
export const StudyPlanQuery = z.object({
  courseId: z.string().min(1).optional(),
  budgetMin: z.coerce.number().int().min(5).max(480).optional(),
});
export type StudyPlanQuery = z.infer<typeof StudyPlanQuery>;

export const PlanItemSchema = z.object({
  type: z.enum(["lesson", "srs_review", "condensed_lesson", "break", "quiz"]),
  title: z.string(),
  estMin: z.number().int().nonnegative(),
  topic: z.string().nullable(),
  source: z.enum(["journey", "srs", "weak_topic", "exam_prep", "budget_fill"]),
  isBreak: z.boolean().optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

/** Scenario block — tells L12 which cards to show (catch-up / cram /
 *  diagnostic banner) and preselects the budget chip. */
export const StudyScenarioSchema = z.object({
  scenario: z.enum([
    "catch_up",
    "cramming",
    "irregular",
    "exam_prep",
    "time_budget",
    "long_absence",
    "normal",
  ]),
  absence: z.object({
    level: z.enum(["none", "short", "long"]),
    daysSince: z.number().int().nonnegative(),
  }),
  cram: z.object({
    isCramming: z.boolean(),
    lessonsPerHour: z.number(),
    ratio: z.number(),
  }),
  budget: z.number().int().nullable(),
});
export type StudyScenario = z.infer<typeof StudyScenarioSchema>;

export const StudyPlanResponse = z.object({
  courseId: z.string(),
  courseName: z.string().nullable(),
  items: z.array(PlanItemSchema),
  totalMin: z.number().int().nonnegative(),
  budgetMin: z.number().int().nonnegative(),
  scenario: StudyScenarioSchema,
});
export type StudyPlanResponse = z.infer<typeof StudyPlanResponse>;

export const ChoosePlanSchema = z.object({
  courseId: z.string().min(1),
  scenario: z.enum([
    "resume",
    "what_i_missed",
    "condensed",
    "start_today",
    "condense",
    "full_speed",
    "break",
    "emergency_plan",
    "weak_topics",
    "quiz",
    "diagnostic",
    "restart",
    "quick_review",
    "micro_lesson",
    "quick_quiz",
  ]),
  budgetMin: z.coerce.number().int().min(5).max(480).optional(),
});
export type ChoosePlanSchema = z.infer<typeof ChoosePlanSchema>;

// ── SRS ──────────────────────────────────────────────────────────────────

export const SrsReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
});
export type SrsReviewSchema = z.infer<typeof SrsReviewSchema>;

export const SrsCardSchema = z.object({
  id: z.string(),
  topic: z.string(),
  dueAt: z.coerce.date(),
  attempts: z.number().int().nonnegative(),
  lastScore: z.number().int().min(0).max(100),
});
export type SrsCard = z.infer<typeof SrsCardSchema>;

export const SrsReviewResponse = z.object({
  dueAt: z.coerce.date(),
  interval: z.number().int().positive(),
  ease: z.enum(["again", "hard", "good", "easy"]),
  mastered: z.boolean().optional(),
});
export type SrsReviewResponse = z.infer<typeof SrsReviewResponse>;

// ── Diagnostic ───────────────────────────────────────────────────────────

export const DiagnosticStartSchema = z.object({
  courseId: z.string().min(1),
});
export type DiagnosticStartSchema = z.infer<typeof DiagnosticStartSchema>;

export const DiagnosticAnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0).max(9),
  answer: z.string().min(1).max(500),
});
export type DiagnosticAnswerSchema = z.infer<typeof DiagnosticAnswerSchema>;

// ── Engagement Events ────────────────────────────────────────────────────

export const EngagementEventSchema = z.object({
  eventType: z.string().min(1).max(64),
  courseId: z.string().optional(),
  sentiment: z.string().max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type EngagementEventSchema = z.infer<typeof EngagementEventSchema>;
