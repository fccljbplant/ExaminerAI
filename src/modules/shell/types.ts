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
  /** Prefix match override (defaults to href). */
  match?: string;
  /** Optional count badge (e.g. grading queue). */
  badge?: number;
}

export interface ShellBrand {
  name: string;
  href?: string;
  /** Logo slot — img/svg/markup. Kept ≤28px tall by the shell. */
  logo?: ReactNode;
}
