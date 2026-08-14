"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — RubricGrader (REDESIGN-P2 §1.4)
 *
 * Level picker per rubric criterion. Presentational: the caller owns
 * entries + the weighted total (computed via the rubric engine in
 * modules/submission) — this component never does math or fetches.
 *
 * - aiAssist criteria show the "AI draft — verify" chip (P3 I4): the
 *   machine-drafted level is pre-selected and flagged until a human
 *   overrides it (human entries always win upstream).
 * - readOnly mode renders the summary the learner sees on L6.
 */

export interface RubricLevelView {
  level: number;
  label: string;
  score: number;
}

export interface RubricCriterionView {
  key: string;
  label: string;
  weight: number;
  aiAssist: boolean;
  levels: RubricLevelView[];
}

export interface RubricEntryView {
  criterionKey: string;
  score: number;
  aiDraft?: boolean;
}

export interface RubricGraderProps {
  rubric: { id: string; title: string; criteria: RubricCriterionView[] };
  entries: RubricEntryView[];
  /** Weighted total on the rubric scale (engine-computed by the caller). */
  totalScore?: number;
  maxScore?: number;
  readOnly?: boolean;
  onChange?: (entries: RubricEntryView[]) => void;
  className?: string;
}

export function RubricGrader({
  rubric,
  entries,
  totalScore,
  maxScore = 100,
  readOnly,
  onChange,
  className,
}: RubricGraderProps) {
  const entryByKey = new Map(entries.map((e) => [e.criterionKey, e]));

  function select(criterionKey: string, score: number) {
    if (readOnly || !onChange) return;
    const rest = entries.filter((e) => e.criterionKey !== criterionKey);
    onChange([...rest, { criterionKey, score, aiDraft: false }]);
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-fg">{rubric.title}</p>
        {totalScore != null && (
          <p className="text-sm font-medium tabular-nums text-fg-secondary">
            {totalScore}
            <span className="text-fg-muted"> / {maxScore}</span>
          </p>
        )}
      </div>
      <div className="divide-y divide-line">
        {rubric.criteria.map((c) => {
          const entry = entryByKey.get(c.key);
          const selected = c.levels.find((l) => l.score === entry?.score);
          return (
            <div key={c.key} className="px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-fg">
                  {c.label}
                  <span className="ml-1.5 text-xs font-normal text-fg-muted">
                    weight {c.weight}
                  </span>
                </p>
                {c.aiAssist && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-info-subtle px-1.5 py-0.5 text-[11px] font-medium text-info-on">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    AI-assisted
                  </span>
                )}
              </div>

              {readOnly ? (
                <p className="text-sm text-fg-secondary">
                  {selected
                    ? `${selected.label} (${selected.score} pts)`
                    : "Not graded"}
                  {entry?.aiDraft && (
                    <span className="ml-2 text-xs text-warning-on">machine draft — verify</span>
                  )}
                </p>
              ) : (
                <div role="radiogroup" aria-label={c.label} className="flex flex-wrap gap-1.5">
                  {c.levels.map((l) => {
                    const active = entry?.score === l.score;
                    return (
                      <button
                        key={l.level}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => select(c.key, l.score)}
                        className={cn(
                          "min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                          active
                            ? "border-brand bg-brand-subtle text-fg"
                            : "border-line bg-bg-subtle text-fg-secondary hover:border-line-strong hover:text-fg"
                        )}
                      >
                        <span className="block font-medium">{l.label}</span>
                        <span className="block text-fg-muted tabular-nums">{l.score} pts</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {entry?.aiDraft && !readOnly && (
                <p className="mt-1.5 text-xs text-warning-on">
                  Machine draft — verify before approving.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
