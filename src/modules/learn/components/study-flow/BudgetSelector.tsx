"use client";

// modules/learn/components/study-flow/BudgetSelector.tsx — L12 budget chips.

/**
 * Time-budget preference (REDESIGN-P3 §L12). The suggested chip is marked
 * with a subtle ring so learners know which one the engine recommends —
 * but any choice is fine (no guilt copy).
 */

export type BudgetValue = 15 | 30 | 60 | null;

interface BudgetOption {
  label: string;
  value: BudgetValue;
  ariaLabel: string;
}

const OPTIONS: BudgetOption[] = [
  { label: "15m", value: 15, ariaLabel: "15 minute session" },
  { label: "30m", value: 30, ariaLabel: "30 minute session" },
  { label: "1h", value: 60, ariaLabel: "1 hour session" },
  { label: "∞", value: null, ariaLabel: "Open-ended session" },
];

interface BudgetSelectorProps {
  value: BudgetValue;
  /** Engine recommendation from `suggestBudget` — gets a highlight ring. */
  suggested: BudgetValue;
  onChange: (budget: BudgetValue) => void;
}

export function BudgetSelector({ value, suggested, onChange }: BudgetSelectorProps) {
  return (
    <section aria-label="Session time budget" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Time today
      </span>
      <div className="flex items-center gap-1.5" role="group" aria-label="Pick a time budget">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          const isSuggested = suggested === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              aria-label={`${opt.ariaLabel}${isSuggested ? " (recommended)" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onChange(opt.value)}
              className={
                isSelected
                  ? "inline-flex h-9 min-w-11 items-center justify-center rounded-full bg-brand px-3 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                  : "inline-flex h-9 min-w-11 items-center justify-center rounded-full border border-line px-3 text-xs font-semibold text-fg-secondary transition-colors hover:border-brand hover:bg-brand-subtle hover:text-fg" +
                    (isSuggested ? " outline-2 outline-offset-2 outline-focus" : "")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
