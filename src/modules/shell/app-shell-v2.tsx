"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "./use-breakpoint";
import { useThemeV2 } from "@/modules/theme";
import { ClassicSidebar } from "./classic-sidebar";
import { ClassicTopbar } from "./classic-topbar";
import { TopNav } from "./top-nav";
import { TabRow } from "./tab-row";
import { BottomNav } from "./bottom-nav";
import { AppFooter } from "./app-footer";
import { SupportModeBanner } from "./support-mode-banner";
import type { NavItem, ShellBrand } from "./types";

/**
 * modules/shell — AppShellV2 (REDESIGN-P2 §5, brief §adaptive-shell)
 *
 * One shell, four structures keyed by useBreakpoint():
 *   xl ≥1280   horizontal TopNav, all items inline
 *   lg 1024–1279  condensed TopNav, overflow into More
 *   md 768–1023   app bar + underline TabRow
 *   xs <768    app bar + fixed BottomNav (5 slots)
 *
 * Content column is capped at 1440px; xs reserves clearance for the
 * fixed BottomNav. A skip link targets <main id="main-content">.
 */

function AppBar({ brand, trailing }: { brand?: ShellBrand; trailing?: ReactNode }) {
  return (
    <header
      data-slot="app-bar"
      className="sticky top-0 z-[var(--p-z-sticky)] border-b border-nav-border bg-nav-bg"
    >
      <div className="flex h-14 items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {brand && (
          <Link
            href={brand.href ?? "/"}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-fg"
          >
            {brand.logo && <span className="flex h-7 items-center">{brand.logo}</span>}
            <span className="truncate">{brand.name}</span>
          </Link>
        )}
        {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
      </div>
    </header>
  );
}

export interface AppShellV2Props {
  nav: NavItem[];
  brand?: ShellBrand;
  /** Right-side chrome: ModeToggle, user menu, notifications, etc. */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShellV2({ nav, brand, trailing, children, className }: AppShellV2Props) {
  const bp = useBreakpoint();
  const pathname = usePathname();
  const withBottomNav = bp === "xs";
  const { mode } = useThemeV2();
  const desktop = bp === "xl" || bp === "lg";
  // Classic mode (Star Admin vertical theme) swaps the horizontal
  // TopNav for a fixed 220px left sidebar on desktop only — mobile
  // keeps the app bar + bottom nav untouched.
  const classicShell = mode === "classic" && desktop;

  return (
    <div data-slot="app-shell" className="min-h-dvh bg-bg text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[var(--p-z-modal)] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-on-brand"
      >
        Skip to content
      </a>

      {/* Support-mode warning + exit — shown in every portal while a
          platform admin is impersonating a user (sup token). */}
      <SupportModeBanner />

      {classicShell ? (
        <>
          <ClassicSidebar nav={nav} brand={brand} />
          <ClassicTopbar trailing={trailing} />
        </>
      ) : (
        <>
          {(bp === "md" || bp === "xs") && <AppBar brand={brand} trailing={trailing} />}
          {bp === "md" && <TabRow items={nav} />}
          {desktop && (
            <TopNav nav={nav} brand={brand} trailing={trailing} visibleCount={bp === "lg" ? 4 : undefined} />
          )}
        </>
      )}

      {/* Bottom nav first in DOM order so it is part of the very first
          paint on mobile — navigation must never wait on content.
          key={pathname} remounts it per route: every page starts with
          the nav visible. */}
      {withBottomNav && <BottomNav key={pathname} nav={nav} />}

      <main
        id="main-content"
        className={cn(
          "mx-auto w-full max-w-[1440px] px-4 pt-4 pb-24 md:px-6 md:pt-6 lg:px-8",
          classicShell && "pt-20 lg:max-w-none lg:pl-[244px] lg:pr-8",
          !withBottomNav && !classicShell && "md:pb-10",
          className
        )}
      >
        {children}
      </main>

      {/* In-app footer — every portal page closes with it (2026-08-15) */}
      <AppFooter classic={classicShell} withBottomNav={withBottomNav} />
    </div>
  );
}
