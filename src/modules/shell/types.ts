import type { ComponentType, ReactNode } from "react";

/**
 * modules/shell — shared types (REDESIGN-P2 §5, brief §adaptive-shell)
 *
 * Breakpoint classes (the ONLY four the product knows):
 *   xs <768 · md 768–1023 · lg 1024–1279 · xl ≥1280
 */

export type BreakpointClass = "xs" | "md" | "lg" | "xl";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  /**
   * Prefix(es) that mark this tab active (defaults to the href).
   * Use for nested routes that hang off a tab (e.g. assignments hangs
   * off Learn). The tab with the LONGEST matching prefix wins — this is
   * what keeps "Home" from staying selected on every sub-route.
   */
  match?: string | string[];
  /** Optional count badge (e.g. grading queue). */
  badge?: number;
}

export interface ShellBrand {
  name: string;
  href?: string;
  /** Logo slot — img/svg/markup. Kept ≤28px tall by the shell. */
  logo?: ReactNode;
}

/**
 * Does a pathname fall under this item's active prefixes?
 * Exact href matches always count; each prefix matches the segment
 * boundary (so /learner never matches /learnerx).
 */
export function itemMatches(pathname: string, item: NavItem): boolean {
  // Exact href always matches. Sub-routes only match when the tab
  // EXPLICITLY opts in via `match` — no match list = exact only (this
  // is what keeps Home from staying selected on every sub-route).
  if (pathname === item.href) return true;
  if (!item.match) return false;
  const prefixes = Array.isArray(item.match) ? item.match : [item.match];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Resolve the single active tab for a pathname: the item with the
 * LONGEST matching prefix wins (most specific). Returns undefined when
 * no tab matches (untabbed detail routes stay neutral instead of
 * highlighting a wrong tab).
 */
export function resolveActiveItem(
  pathname: string,
  nav: NavItem[],
): NavItem | undefined {
  const matches = nav.filter((item) => itemMatches(pathname, item));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, item) => {
    const bestLen = longestPrefixLength(pathname, best);
    const itemLen = longestPrefixLength(pathname, item);
    if (itemLen > bestLen) return item;
    if (itemLen === bestLen && pathname === item.href) return item;
    return best;
  });
}

function longestPrefixLength(pathname: string, item: NavItem): number {
  if (pathname === item.href) return Number.MAX_SAFE_INTEGER;
  if (!item.match) return 0;
  const prefixes = Array.isArray(item.match) ? item.match : [item.match];
  return Math.max(0, ...prefixes.filter((p) => pathname === p || pathname.startsWith(`${p}/`)).map((p) => p.length));
}
