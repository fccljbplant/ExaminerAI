"use client";

/**
 * EmptyState — Phase C visual refresh.
 *
 * A reusable illustrated empty state. Replaces the bare
 * "No data" / "No students enrolled yet" text with a friendly
 * icon-in-circle illustration + title + description + optional
 * CTA. The illustration has a gentle float animation so the
 * screen doesn't feel "dead" when empty.
 *
 * Usage:
 *   <EmptyState
 *     icon={Users}
 *     title="No students yet"
 *     description="Students will appear here once they sign up and are approved."
 *     tone="sage"
 *   />
 *   <EmptyState
 *     icon={CheckCircle2}
 *     title="All caught up!"
 *     description="No pending approvals."
 *     action={<Button>Refresh</Button>}
 *   />
 */

import { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Lucide icon component (or any component accepting className). */
  icon: ComponentType<{ className?: string }>;
  /** Bold one-liner. */
  title: string;
  /** 1-2 sentences of explanation / guidance. */
  description?: string;
  /** Optional CTA button / link. */
  action?: React.ReactNode;
  /** Semantic tone — controls the soft background tint of the circle. */
  tone?: "sage" | "warning" | "coral" | "muted";
  /** Size of the illustration circle. */
  size?: "sm" | "md" | "lg";
  /** Disable the float animation (for non-empty "all caught up" states). */
  noFloat?: boolean;
}

const TONE_CLASSES: Record<NonNullable<EmptyStateProps["tone"]>, { circle: string; icon: string }> = {
  sage:  { circle: "bg-growth-sage-soft",  icon: "text-growth-sage" },
  warning: { circle: "bg-growth-amber-soft", icon: "text-growth-amber" }, // keeps amber CSS vars
  coral: { circle: "bg-growth-coral-soft", icon: "text-growth-coral" },
  muted: { circle: "bg-muted",             icon: "text-muted-foreground" },
};

const SIZE_CLASSES: Record<NonNullable<EmptyStateProps["size"]>, { circle: string; icon: string }> = {
  sm: { circle: "h-12 w-12",  icon: "h-5 w-5"  },
  md: { circle: "h-16 w-16",  icon: "h-7 w-7"  },
  lg: { circle: "h-24 w-24",  icon: "h-10 w-10" },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "muted",
  size = "md",
  noFloat = false,
}: EmptyStateProps) {
  const toneClasses = TONE_CLASSES[tone];
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center animate-fade-in-up">
      <div
        className={cn(
          "flex items-center justify-center rounded-full mb-3",
          toneClasses.circle,
          sizeClasses.circle,
          !noFloat && "animate-float",
        )}
      >
        <Icon className={cn(toneClasses.icon, sizeClasses.icon)} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * EmptyStateCard — wraps EmptyState in the modern SaaS "single primary
 * action" pattern (Stripe / Linear / Resend).
 *
 * The research was clear: every empty state should have ONE primary CTA.
 * This wrapper enforces that — pass `primaryAction` (required) and an
 * optional `secondaryAction`. The card chrome + tone + illustration are
 * handled for you.
 *
 * Voice (per docs/UI-STANDARDS.md):
 *   - Title: 3-6 words, action-oriented ("Send your first email").
 *   - Description: 1 sentence, starts with the next action, not the state.
 *   - Use contractions. Drop "please." Be specific about numbers.
 *
 * Usage:
 *   <EmptyStateCard
 *     icon={Users}
 *     title="No students yet"
 *     description="Once an admin enrolls students, they'll show up here."
 *     primaryAction={<Button>Invite students</Button>}
 *   />
 */
export interface EmptyStateCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** Required — the single primary next action (Stripe / Linear rule). */
  primaryAction: React.ReactNode;
  /** Optional secondary "learn more" link (text-only, no button chrome). */
  secondaryAction?: React.ReactNode;
  tone?: "sage" | "warning" | "coral" | "muted";
  size?: "sm" | "md" | "lg";
}

export function EmptyStateCard({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tone = "muted",
  size = "md",
}: EmptyStateCardProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in-up">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        tone={tone}
        size={size}
        noFloat
      />
      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
}
