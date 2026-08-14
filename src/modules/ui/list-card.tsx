import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — ListCard (REDESIGN-P2 §1.4)
 *
 * The mobile-first row primitive. Every DataTable degrades to a
 * ListCard stack on xs (3 key fields + inline actions). Also used
 * natively for alerts, approvals, queues.
 *
 * Row anatomy: [leading] title / meta ........ [trailing] [actions]
 * Rows are ≥44px tap targets with an 8px gap law.
 */

export interface ListCardRowProps {
  title: ReactNode;
  /** Second line under the title (keep to 1–2 short fields on xs). */
  meta?: ReactNode;
  /** Leading avatar/icon/status dot slot. */
  leading?: ReactNode;
  /** Trailing value/status slot (right-aligned, tabular). */
  trailing?: ReactNode;
  /** Inline actions — revealed chrome on hover, always visible on touch. */
  actions?: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function ListCardRow({
  title,
  meta,
  leading,
  trailing,
  actions,
  onClick,
  href,
  className,
}: ListCardRowProps) {
  const interactive = Boolean(onClick || href);
  const Wrapper = href ? "a" : interactive ? "button" : "div";

  return (
    <Wrapper
      data-slot="list-card-row"
      {...(href ? { href } : {})}
      {...(onClick && !href ? { onClick, type: "button" as const } : {})}
      className={cn(
        "group flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left",
        interactive &&
          "cursor-pointer transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        className
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{title}</p>
        {meta && <p className="mt-0.5 truncate text-xs text-fg-muted">{meta}</p>}
      </div>
      {trailing && (
        <div className="shrink-0 text-right text-sm font-medium tabular-nums text-fg-secondary">
          {trailing}
        </div>
      )}
      {actions && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1",
            // hover-reveal on pointer devices; always visible on touch
            "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
          )}
        >
          {actions}
        </div>
      )}
    </Wrapper>
  );
}

export interface ListCardProps {
  children: ReactNode;
  className?: string;
  /** Optional header row (renders outside the bordered card). */
  header?: ReactNode;
}

export function ListCard({ children, className, header }: ListCardProps) {
  return (
    <div data-slot="list-card" className={cn("space-y-2", className)}>
      {header && <div className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{header}</div>}
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {children}
      </div>
    </div>
  );
}
