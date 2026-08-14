"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/modules/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { resolveActiveItem, type NavItem } from "./types";
import { useNavVisibility } from "./use-scroll-direction";

/**
 * modules/shell — BottomNav (xs, <768)
 *
 * Fixed bottom navigation: max 5 equal slots (brief §adaptive-shell),
 * each ≥56px tall. If a portal has more than 5 items the first four
 * render inline and a More slot opens a BottomSheet with the rest.
 * Active state is M3-style: a brand-subtle pill behind the icon.
 *
 * Mobile comfort: the nav hides on scroll-down and returns on
 * scroll-up (or at the very top), pauses while the More sheet is
 * open, and honours reduced motion. Landscape safe-area insets are
 * applied on both sides so notch devices never clip the tabs.
 */

const MAX_INLINE = 5;

function BottomNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] transition-colors",
        "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        active ? "text-fg" : "text-fg-muted hover:text-fg-secondary"
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
          active && "bg-brand-subtle"
        )}
      >
        {Icon ? (
          <Icon className="h-5 w-5" aria-hidden />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        )}
        {typeof item.badge === "number" && item.badge > 0 && (
          <span
            aria-hidden
            className="absolute right-2.5 top-0 h-2 w-2 rounded-full bg-brand ring-2 ring-nav-bg"
          />
        )}
      </span>
      <span className="w-full truncate text-center leading-tight">{item.label}</span>
    </Link>
  );
}

export function BottomNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibility = useNavVisibility();
  // Single active tab: the LONGEST matching prefix wins (fixes Home
  // staying selected on every sub-route across all portals).
  const activeId = resolveActiveItem(pathname, nav)?.id;

  // Tuck the nav away while reading (sustained scroll-down), bring it
  // back on a deliberate scroll-up, at the top, or while the More sheet
  // is open. Hysteresis in the hook keeps jitter from blinking the nav.
  const hidden = !moreOpen && visibility === "hidden";

  const condensed = nav.length > MAX_INLINE;
  const inline = condensed ? nav.slice(0, MAX_INLINE - 1) : nav;
  const overflow = condensed ? nav.slice(MAX_INLINE - 1) : [];
  const slots = inline.length + (overflow.length > 0 ? 1 : 0);
  const gridCols =
    slots <= 3 ? "grid-cols-3" : slots === 4 ? "grid-cols-4" : "grid-cols-5";

  return (
    <>
      <nav
        data-slot="bottom-nav"
        aria-label="Primary"
        aria-hidden={hidden}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[var(--p-z-sticky)] border-t border-nav-border bg-nav-bg",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] md:hidden",
          // transform-based (not Tailwind's translate-*) so the tuck works
          // even where the --tw-translate-* var chain doesn't resolve.
          "transition-transform duration-200 motion-reduce:transition-none",
          hidden && "[transform:translateY(100%)]"
        )}
      >
        <div className={cn("grid", gridCols)}>
          {inline.map((item) => (
            <BottomNavItem key={item.id} item={item} active={item.id === activeId} />
          ))}
          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-fg-muted transition-colors hover:text-fg-secondary [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <span className="relative flex h-7 w-14 items-center justify-center">
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                {overflow.some((i) => i.id === activeId) && (
                  <span className="absolute right-3 top-0.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                )}
              </span>
              <span className="leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      <BottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="More"
        description="All sections"
      >
        <div className="grid grid-cols-3 gap-2">
          {overflow.map((item) => {
            const active = item.id === activeId;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs transition-colors [-webkit-tap-highlight-color:transparent]",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  active
                    ? "border-brand bg-brand-subtle font-medium text-fg"
                    : "border-line bg-surface text-fg-secondary hover:bg-bg-subtle"
                )}
              >
                {Icon && <Icon className="h-5 w-5" aria-hidden />}
                <span className="line-clamp-2 text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
