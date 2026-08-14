"use client";

// modules/learn/components/study-flow/CramCard.tsx — L12 cram card (S2).

import { Gauge } from "lucide-react";

/**
 * Cram card (REDESIGN-P3 §L12, scenario S2). Shown when the 24 h lesson
 * velocity hits 3× the learner's personal baseline. Offers accelerated
 * mode with an honest (never scolding) retention warning.
 */

interface CramOption {
  label: string;
  value: "condense" | "full_speed" | "break";
}

const OPTIONS: CramOption[] = [
  { label: "Condense next topics", value: "condense" },
  { label: "Keep going full speed", value: "full_speed" },
  { label: "Schedule a break", value: "break" },
];

interface CramCardProps {
  lessonsPerHour: number;
  ratio: number;
  onChoose: (value: CramOption["value"]) => void;
}

export function CramCard({ lessonsPerHour, ratio, onChoose }: CramCardProps) {
  return (
    <section
      aria-label="Accelerated mode"
      className="rounded-xl border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-fg">
          <Gauge className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-fg">You&apos;re on a roll!</h2>
        <span className="inline-flex items-center rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning-on">
          Retention drops at this pace
        </span>
      </div>
      <p className="mt-2 text-sm text-fg-secondary">
        That&apos;s {lessonsPerHour} lessons/hour — about {ratio}× your usual
        pace. Impressive! Want me to condense the next topics so more of it
        sticks?
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChoose(opt.value)}
            className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-fg-secondary transition-colors hover:border-brand hover:bg-brand-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
