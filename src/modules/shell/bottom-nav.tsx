"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/modules/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

/**
 * modules/shell — BottomNav (xs, <768)
 *
 * Fixed bottom navigation: max 5 equal slots (brief §adaptive-shell),
 * each ≥56px tall. If a portal has more than 5 items the first four
 * render inline and a More slot opens a BottomSheet with the rest.
 * Active state is M3-style: a brand-subtle pill behind the icon.
 */

const MAX_INLINE = 5;

function isActive(pathname: string, item: NavItem): boolean {
  const prefix = item.match ?? item.href;
  return pathname === item.href || pathname.startsWith(prefix);
}

function BottomNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] transition-colors",
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
        className="fixed inset-x-0 bottom-0 z-[var(--p-z-sticky)] border-t border-nav-border bg-nav-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className={cn("grid", gridCols)}>
          {inline.map((item) => (
            <BottomNavItem key={item.id} item={item} pathname={pathname} />
          ))}
          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-fg-muted transition-colors hover:text-fg-secondary"
            >
              <span className="relative flex h-7 w-14 items-center justify-center">
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                {overflow.some((i) => isActive(pathname, i)) && (
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
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs transition-colors",
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
