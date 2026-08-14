import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — KPI + StatStrip (REDESIGN-P2 §1.4, P3 global rules)
 *
 * KPI is the atomic stat tile: label, big tabular value, delta chip,
 * optional icon + sparkline slot, tap-to-expand. StatStrip lays KPIs
 * out as a snap-scroll carousel on xs and a dense equal row on md+.
 * Above-the-fold rule: every dashboard leads with these.
 */

export type KpiTone = "default" | "success" | "warning" | "danger" | "info";

export interface KpiDelta {
  label: string;
  direction: "up" | "down" | "flat";
  /** "good" maps direction→color (up isn't always good). */
  sentiment?: "good" | "bad" | "neutral";
}

export interface KpiProps {
  label: string;
  value: ReactNode;
  delta?: KpiDelta;
  tone?: KpiTone;
  icon?: ReactNode;
  /** Sparkline slot — chart wrappers render into this. */
  sparkline?: ReactNode;
  /** Tap-to-expand (fullscreen chart / drill-down sheet). */
  onExpand?: () => void;
  className?: string;
}

const DELTA_ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

function deltaClasses(delta: KpiDelta): string {
  const sentiment = delta.sentiment ?? (delta.direction === "flat" ? "neutral" : "good");
  if (sentiment === "neutral") return "bg-bg-subtle text-fg-muted";
  const good =
    sentiment === "good" ? delta.direction === "up" : delta.direction === "down";
  return good ? "bg-success-subtle text-success-on" : "bg-danger-subtle text-danger-on";
}

const TONE_ACCENT: Record<KpiTone, string> = {
  default: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function Kpi({
  label,
  value,
  delta,
  tone = "default",
  icon,
  sparkline,
  onExpand,
  className,
}: KpiProps) {
  const interactive = Boolean(onExpand);
  const Wrapper = interactive ? "button" : "div";
  const DeltaIcon = delta ? DELTA_ICONS[delta.direction] : null;

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={onExpand}
      data-slot="kpi"
      className={cn(
        "relative w-full min-w-[240px] snap-start overflow-hidden rounded-xl border border-line bg-surface p-4 text-left",
        interactive &&
          "min-h-11 cursor-pointer transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-w-0",
        className
      )}
    >
      {/* tone accent bar */}
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", TONE_ACCENT[tone])} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-fg-muted">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-fg">{value}</p>
        </div>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
            {icon}
          </span>
        )}
      </div>
      {(delta || sparkline) && (
        <div className="mt-2 flex items-center justify-between gap-2 pl-2">
          {delta && DeltaIcon ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                deltaClasses(delta)
              )}
            >
              <DeltaIcon className="h-3 w-3" aria-hidden />
              {delta.label}
            </span>
          ) : (
            <span />
          )}
          {sparkline && <div className="h-7 w-20 shrink-0">{sparkline}</div>}
        </div>
      )}
    </Wrapper>
  );
}

/** xs: horizontal snap carousel · md+: dense equal-width row. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="stat-strip"
      className={cn(
        // no-scrollbar keeps the carousel clean; snap gives the "one KPI per swipe" feel
        "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "md:grid md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] md:overflow-visible md:pb-0",
        className
      )}
    >
      {children}
    </div>
  );
}
