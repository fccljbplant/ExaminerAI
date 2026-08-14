/**
 * modules/submission/lib/rubric-engine.ts — W4 pure rubric engine
 * (REDESIGN-P4 §5)
 *
 * Weighted scoring over rubric criteria. Pure — no db, no React, no AI.
 * AI drafts (aiAssist criteria) are computed the same way but carry the
 * aiDraft flag; a human entry for the same criterion always wins over an
 * AI draft entry.
 */

import type { CriterionEntry } from "../contracts";

// ── Rubric shape (mirrors Rubric + RubricCriterion rows) ────────────────

export interface RubricLevel {
  level: number;
  label: string;
  score: number;
}

export interface RubricCriterionDef {
  key: string;
  label: string;
  weight: number;
  aiAssist: boolean;
  levels: RubricLevel[];
}

export interface RubricDef {
  id: string;
  title: string;
  /** Final scale the weighted score maps onto (assignments default 100). */
  maxScore: number;
  criteria: RubricCriterionDef[];
}

// ── Result ───────────────────────────────────────────────────────────────

export interface CriterionResult {
  criterionKey: string;
  label: string;
  weight: number;
  /** Raw points given for this criterion. */
  score: number;
  /** This criterion's max achievable points (highest level score). */
  maxScore: number;
  /** score / maxScore — 0 when ungraded. */
  normalized: number;
  /** True when the winning entry was an AI draft. */
  aiDraft: boolean;
  note?: string;
}

export interface RubricGradeResult {
  /** Weighted score on the rubric's scale (0..maxScore). */
  totalScore: number;
  perCriterion: CriterionResult[];
  /** Graded criteria / total criteria (1 = fully graded). */
  coverage: number;
  /** How many winning entries are still AI drafts. */
  aiDraftCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function criterionMax(c: RubricCriterionDef): number {
  return c.levels.reduce((m, l) => Math.max(m, l.score), 0);
}

/**
 * Collapse entries to one per criterion. When both an AI draft and a human
 * entry exist for the same criterion the human entry wins ("human entries
 * always win" — P4 §5).
 */
function collapseEntries(entries: CriterionEntry[]): Map<string, CriterionEntry> {
  const byKey = new Map<string, CriterionEntry>();
  for (const e of entries) {
    const existing = byKey.get(e.criterionKey);
    if (!existing) {
      byKey.set(e.criterionKey, e);
      continue;
    }
    // Human beats AI draft regardless of order.
    if (existing.aiDraft && !e.aiDraft) byKey.set(e.criterionKey, e);
  }
  return byKey;
}

// ── Core ─────────────────────────────────────────────────────────────────

/**
 * Grade a submission against a rubric.
 *
 * Math: each criterion is normalized to 0..1 against its own highest level
 * score, multiplied by its weight, summed, then rescaled:
 *   total = Σ(normalized_i × weight_i) / Σ(weight_i) × rubric.maxScore
 *
 * Ungraded criteria count as 0 (coverage < 1 tells the reviewer). Entries
 * referencing unknown criterion keys are ignored.
 */
export function grade(
  rubric: RubricDef,
  entries: CriterionEntry[],
): RubricGradeResult {
  const collapsed = collapseEntries(entries);
  const totalWeight = rubric.criteria.reduce((s, c) => s + c.weight, 0);

  let weightedSum = 0;
  let graded = 0;
  let aiDraftCount = 0;

  const perCriterion: CriterionResult[] = rubric.criteria.map((c) => {
    const entry = collapsed.get(c.key);
    const maxScore = criterionMax(c);
    const score = entry ? Math.min(entry.score, maxScore) : 0;
    const normalized = maxScore > 0 ? score / maxScore : 0;

    if (entry) {
      graded += 1;
      weightedSum += normalized * c.weight;
      if (entry.aiDraft) aiDraftCount += 1;
    }

    return {
      criterionKey: c.key,
      label: c.label,
      weight: c.weight,
      score,
      maxScore,
      normalized,
      aiDraft: entry?.aiDraft ?? false,
      note: entry?.note,
    };
  });

  const totalScore =
    totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * rubric.maxScore * 100) / 100
      : 0;

  return {
    totalScore,
    perCriterion,
    coverage: rubric.criteria.length > 0 ? graded / rubric.criteria.length : 0,
    aiDraftCount,
  };
}
