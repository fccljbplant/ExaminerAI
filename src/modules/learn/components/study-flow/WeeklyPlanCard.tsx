"use client";

// modules/learn/components/study-flow/WeeklyPlanCard.tsx — L12 today's plan.

import { BookOpen, Coffee, Repeat, Target, Zap } from "lucide-react";
import type { PlanItem } from "@/modules/learn/contracts";

/**
 * Today's study plan (REDESIGN-P3 §L12): the ordered PlanItems the engine
 * generated for the selected budget, with a planned-vs-budget BarMini at
 * the bottom. Breaks render muted — they are reminders, not work.
 */

function itemIcon(type: PlanItem["type"]) {
  switch (type) {
    case "srs_review":
      return <Repeat className="h-4 w-4" aria-hidden />;
    case "quiz":
      return <Target className="h-4 w-4" aria-hidden />;
    case "condensed_lesson":
      return <Zap className="h-4 w-4" aria-hidden />;
    case "break":
      return <Coffee className="h-4 w-4" aria-hidden />;
    default:
      return <BookOpen className="h-4 w-4" aria-hidden />;
  }
}

const SOURCE_LABEL: Record<PlanItem["source"], string> = {
  journey: "Lesson",
  srs: "Review",
  weak_topic: "Practice",
  exam_prep: "Exam prep",
  budget_fill: "Break",
};

interface WeeklyPlanCardProps {
  items: PlanItem[];
  totalMin: number;
  budgetMin: number | null;
}

export function WeeklyPlanCard({ items, totalMin, budgetMin }: WeeklyPlanCardProps) {
  // Planned-vs-budget BarMini. Null budget (open-ended) hides the bar —
  // there is nothing to compare against.
  const budgetPct =
    budgetMin && budgetMin > 0 ? Math.min(100, Math.round((totalMin / budgetMin) * 100)) : null;

  return (
    <section
      aria-label="Today's plan"
      className="rounded-xl border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">Today&apos;s plan</h2>
        <span className="text-xs tabular-nums text-fg-muted">
          {totalMin} min planned{budgetMin ? ` of ${budgetMin} min` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Nothing scheduled yet — pick a time budget above and we&apos;ll line
          something up for you.
        </p>
      ) : (
        <>
          <ol className="mt-3 space-y-1.5">
            {items.map((item, i) => (
              <li
                key={`${i}-${item.title}`}
                className={
                  item.isBreak
                    ? "flex items-center gap-3 rounded-lg px-2 py-2 opacity-70"
                    : "flex items-center gap-3 rounded-lg px-2 py-2"
                }
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                  {itemIcon(item.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      item.isBreak
                        ? "truncate text-sm text-fg-muted"
                        : "truncate text-sm font-medium text-fg"
                    }
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-fg-muted">{SOURCE_LABEL[item.source]}</p>
                </div>
                <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-fg-secondary">
                  {item.estMin}m
                </span>
              </li>
            ))}
          </ol>

          {budgetPct !== null && (
            <div className="mt-4" aria-label={`${budgetPct}% of budget planned`}>
              <div
                role="progressbar"
                aria-valuenow={budgetPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
