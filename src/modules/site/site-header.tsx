"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  GraduationCap,
  Menu,
  PackageOpen,
  Search,
  ShieldCheck,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/modules/ui/button";

/**
 * modules/site — SiteHeader (2026-08-15 storefront chrome pass)
 *
 * ONE header for the whole public site (the pages previously each
 * hand-rolled their own banner, and several had no header at all).
 * Token-only styling, so Light / Dark / Bed / Classic all apply.
 *
 * - Announcement bar (marketing, dismiss-free — one line)
 * - Logo · desktop nav (Courses / Paths / Pricing / For Business /
 *   Support) · course search · auth (Dashboard when signed in)
 * - Category strip with live course counts
 * - Mobile: hamburger → sheet with nav, search, auth
 */

export interface SiteCategory {
  value: string;
  label: string;
  count: number;
}

const NAV_LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/paths", label: "Learning Paths" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-business", label: "For Business" },
  { href: "/support", label: "Support" },
] as const;

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "technology":
      return <Bot className="h-4 w-4" aria-hidden />;
    case "engineering":
      return <Wrench className="h-4 w-4" aria-hidden />;
    case "business":
      return <Building2 className="h-4 w-4" aria-hidden />;
    case "finance":
      return <TrendingUp className="h-4 w-4" aria-hidden />;
    case "healthcare":
      return <ShieldCheck className="h-4 w-4" aria-hidden />;
    default:
      return <PackageOpen className="h-4 w-4" aria-hidden />;
  }
}

function SearchForm({ className = "" }: { className?: string }) {
  return (
    <form action="/courses" method="get" className={`flex min-w-0 items-center ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        Search courses
      </label>
      <div className="flex h-10 w-full items-center overflow-hidden rounded-full border border-line bg-bg transition-colors focus-within:border-brand">
        <Search className="ml-3 h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
        <input
          id="site-search"
          type="search"
          name="search"
          placeholder="Search courses, skills, topics…"
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none"
        />
        <button
          type="submit"
          className="mr-1 inline-flex h-8 shrink-0 items-center rounded-full bg-brand px-4 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export function SiteHeader({
  categories,
  signedIn,
  dashboardHref,
}: {
  categories: SiteCategory[];
  signedIn: boolean;
  dashboardHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* ── Announcement bar ─────────────────────────────────── */}
      <div className="bg-brand px-4 py-1.5 text-center text-xs font-medium text-on-brand">
        🎉 AI-driven courses with verified certificates — start free today · New tracks every
        week
      </div>

      {/* ── Main header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-[var(--p-z-sticky)] border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <span className="hidden sm:inline">TraineesAI</span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Site">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Course search — desktop + tablet */}
          <SearchForm className="hidden min-w-0 flex-1 justify-center md:flex" />

          {/* Auth */}
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {signedIn ? (
              <Button asChild size="sm">
                <Link href={dashboardHref}>
                  Dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/for-learners">
                    Start Free <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="site-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* ── Category strip — the storefront nav ─────────────── */}
        <nav className="border-t border-line" aria-label="Course categories">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
            <Link
              href="/courses"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-on-brand"
            >
              <PackageOpen className="h-3.5 w-3.5" aria-hidden />
              All Courses
              <span className="rounded-full bg-on-brand/20 px-1.5 text-[10px] tabular-nums">
                {categories.reduce((sum, c) => sum + c.count, 0)}
              </span>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.value}
                href={`/courses/category/${c.value}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
              >
                <CategoryIcon category={c.value} />
                {c.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Mobile menu sheet ─────────────────────────────────── */}
      {menuOpen && (
        <div
          id="site-mobile-menu"
          className="fixed inset-x-0 top-28 bottom-0 z-[var(--p-z-drawer)] border-t border-line bg-bg lg:hidden"
        >
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4" aria-label="Site mobile">
            <SearchForm className="mb-3" />
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium text-fg transition-colors hover:bg-bg-subtle"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {signedIn ? (
                <Button asChild>
                  <Link href={dashboardHref} onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline">
                    <Link href="/login" onClick={() => setMenuOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/for-learners" onClick={() => setMenuOpen(false)}>
                      Start Free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
