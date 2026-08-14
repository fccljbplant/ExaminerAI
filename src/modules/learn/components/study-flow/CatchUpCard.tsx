"use client";

// modules/learn/components/study-flow/CatchUpCard.tsx — L12 catch-up card (S1).

import { CalendarCheck } from "lucide-react";

/**
 * Catch-up card (REDESIGN-P3 §L12, scenario S1). Shown when a 3–7 day
 * absence is detected. Four ways back in — the learner picks what feels
 * right. All copy is encouraging; we never frame the absence as failure.
 */

interface CatchUpOption {
  label: string;
  description: string;
  value: "resume" | "what_i_missed" | "condensed" | "start_today";
}

const OPTIONS: CatchUpOption[] = [
  {
    label: "Resume where I left off",
    description: "Continue your journey at the exact lesson you stopped at.",
    value: "resume",
  },
  {
    label: "Show what I missed",
    description: "A quick summary of the lessons that happened while you were away.",
    value: "what_i_missed",
  },
  {
    label: "Condensed plan (10 min)",
    description: "The key ideas from the missed lessons, packed tight.",
    value: "condensed",
  },
  {
    label: "Start from today",
    description: "Skip the backlog — begin with today's material and pick up scraps later.",
    value: "start_today",
  },
];

interface CatchUpCardProps {
  daysSince: number;
  onChoose: (value: CatchUpOption["value"]) => void;
}

export function CatchUpCard({ daysSince, onChoose }: CatchUpCardProps) {
  return (
    <section
      aria-label="Welcome back"
      className="rounded-xl border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-fg">
          <CalendarCheck className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-fg">Welcome back!</h2>
      </div>
      <p className="mt-2 text-sm text-fg-secondary">
        It&apos;s been {daysSince} days — totally fine. How would you like to
        get back into it?
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChoose(opt.value)}
            className="rounded-lg border border-line bg-bg p-3 text-left transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <p className="text-sm font-semibold text-fg">{opt.label}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{opt.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
