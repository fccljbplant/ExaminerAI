"use client";
// src/components/shared/stat-card.tsx
// The standard stat card used across every dashboard.
//
// Replaces the ad-hoc `<Card><CardContent className="p-4"><div className="text-2xl">
// ...` pattern that was copy-pasted in every dashboard. One component,
// consistent spacing, consistent typography, accessible labels.

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

export type StatTone = "default" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<StatTone, { value: string; icon: string; ring: string }> = {
  default: {
    value: "text-foreground",
    icon: "text-muted-foreground",
    ring: "",
  },
  success: {
    value: "text-growth-sage dark:text-growth-sage",
    icon: "text-growth-sage",
    ring: "ring-growth-sage/20",
  },
  warning: {
    value: "text-growth-amber dark:text-growth-amber",
    icon: "text-growth-amber",
    ring: "ring-growth-amber/20",
  },
  danger: {
    value: "text-destructive dark:text-destructive",
    icon: "text-destructive",
    ring: "ring-destructive/20",
  },
  info: {
    value: "text-sky-600 dark:text-sky-400",
    icon: "text-sky-500",
    ring: "ring-sky-500/20",
  },
};

/** Star Admin-style delta badge (e.g. +12% vs last week). */
export interface StatDelta {
  /** Short text like "+12%" or "3 new". */
  value: string;
  /** up = success tint, down = destructive tint, flat = muted. */
  direction: "up" | "down" | "flat";
}

export interface StatCardProps {
  /** The big number or short string (e.g. "42", "$3.2K", "68%"). */
  value: string | number;
  /** Label under the value (e.g. "Active learners"). */
  label: string;
  /** Optional sub-label for context (e.g. "+12 this week"). */
  hint?: string;
  /** Optional delta chip rendered next to the value (Star Admin pattern). */
  delta?: StatDelta;
  /** Optional icon (any lucide icon component). */
  icon?: LucideIcon;
  /** Optional onClick — makes the card a button (e.g. jump to a tab). */
  onClick?: () => void;
  /** Visual tone — defaults to neutral. */
  tone?: StatTone;
  /** Optional extra className. */
  className?: string;
  /** Optional progress bar (0-100). Renders under the value. */
  progress?: number;
}

export function StatCard({
  value,
  label,
  hint,
  delta,
  icon: Icon,
  onClick,
  tone = "default",
  className = "",
  progress,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  const DeltaIcon = delta?.direction === "up" ? TrendingUp : delta?.direction === "down" ? TrendingDown : Minus;

  const content = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1 text-2xl font-bold leading-none", styles.value)}>
            {value}
          </p>
          {delta && (
            <span
              className={cn(
                "chip-delta mt-1.5",
                delta.direction === "up" && "chip-delta-up",
                delta.direction === "down" && "chip-delta-down",
                delta.direction === "flat" && "chip-delta-flat"
              )}
            >
              <DeltaIcon className="h-3 w-3" aria-hidden />
              {delta.value}
            </span>
          )}
          {hint && (
            <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{hint}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60",
              styles.icon
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </CardContent>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "block w-full text-left rounded-xl ring-1 transition hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          styles.ring || "ring-border",
          className
        )}
      >
        <Card className="border-0 bg-transparent shadow-none">{content}</Card>
      </button>
    );
  }

  return (
    <Card className={cn("bg-card", className)}>
      {content}
    </Card>
  );
}

/** A compact stat strip — the row of 4 small stats at the top of a dashboard. */
export function StatStrip({
  stats,
  className = "",
}: {
  stats: Array<Omit<StatCardProps, "className">>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4",
        className
      )}
      role="list"
      aria-label="Key statistics"
    >
      {stats.map((s, i) => (
        <div key={i} role="listitem">
          <StatCard {...s} />
        </div>
      ))}
    </div>
  );
}

/** Re-export ReactNode type for consumers. */
export type { ReactNode };
