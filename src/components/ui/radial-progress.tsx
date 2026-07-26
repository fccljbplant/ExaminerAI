"use client";

/**
 * RadialProgress — Phase C visual refresh.
 *
 * A circular progress indicator that replaces the 1.5px linear
 * Progress bar for the consistency % (rolling 14-day). The radial
 * shape feels more "milestone"-like than a thin horizontal line,
 * and the percentage in the center gives the number context.
 *
 * Color is chosen by semantic intent, not by raw value:
 *   - "sage"   → growth / on-track      (default)
 *   - "warning"  → attention / mid-progress
 *   - "coral"  → needs-care / low
 *
 * Usage:
 *   <RadialProgress value={72} label="Consistency" />
 *   <RadialProgress value={28} tone="coral" size="sm" />
 *
 * Accessibility: role="progressbar" with aria-valuenow / min / max.
 */

import { cn } from "@/lib/utils";

export interface RadialProgressProps {
  /** 0-100. Values outside this range are clamped. */
  value: number;
  /** Optional label shown BELOW the circle (not inside). */
  label?: string;
  /** Optional sublabel (e.g. "of 14 days"). */
  sublabel?: string;
  /** Semantic color tone — default "sage". */
  tone?: "sage" | "warning" | "coral";
  /** Visual size. */
  size?: "sm" | "md" | "lg";
  /** Override the auto-selected tone with a fixed one based on value. */
  autoTone?: boolean;
}

const TONE_COLORS: Record<NonNullable<RadialProgressProps["tone"]>, { stroke: string; soft: string; text: string }> = {
  sage:  { stroke: "var(--growth-sage)",           soft: "var(--growth-sage-soft)",        text: "var(--growth-sage-foreground)" },
  warning: { stroke: "var(--growth-amber)",          soft: "var(--growth-amber-soft)",       text: "var(--growth-amber-foreground)" }, // keeps amber CSS vars
  coral: { stroke: "var(--growth-coral)",          soft: "var(--growth-coral-soft)",       text: "var(--growth-coral-foreground)" },
};

const SIZE_PX: Record<NonNullable<RadialProgressProps["size"]>, number> = {
  sm: 56,
  md: 96,
  lg: 140,
};

export function RadialProgress({
  value,
  label,
  sublabel,
  tone,
  size = "md",
  autoTone = false,
}: RadialProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  // Auto-tone: pick color by value thresholds (only if no explicit tone + autoTone)
  const effectiveTone: NonNullable<RadialProgressProps["tone"]> = tone ?? (
    autoTone
      ? clamped >= 70 ? "sage" : clamped >= 40 ? "warning" : "coral"
      : "sage"
  );
  const colors = TONE_COLORS[effectiveTone];
  const px = SIZE_PX[size];
  const strokeWidth = size === "sm" ? 4 : size === "md" ? 6 : 8;
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || "progress"}
    >
      <div className="relative" style={{ width: px, height: px }}>
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          className="-rotate-90"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background ring */}
          <circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            stroke={colors.soft}
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        {/* Centered percentage */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold tabular-nums",
            size === "sm" ? "text-sm" : size === "md" ? "text-xl" : "text-3xl",
          )}
          style={{ color: colors.text }}
        >
          {Math.round(clamped)}%
        </div>
      </div>
      {(label || sublabel) && (
        <div className="text-center">
          {label && (
            <div className="text-xs font-medium text-foreground">{label}</div>
          )}
          {sublabel && (
            <div className="text-[10px] text-muted-foreground">{sublabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
