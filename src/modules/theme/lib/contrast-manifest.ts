/**
 * Theme Module — Contrast manifest (REDESIGN-P2 §2.3.6 / §2.4)
 *
 * Every color pair the product actually uses, registered once.
 * scripts/validate-theme.ts asserts each pair per mode × brand.
 * brandDependent pairs get their fg/bg from deriveBrandPalette at
 * runtime; static pairs resolve from tokens/semantic.css.
 */

export type ThemeMode = "light" | "dark" | "bed";

export interface ContrastPair {
  id: string;
  /** CSS var name (without --), resolved per mode */
  fg: string;
  bg: string;
  /** WCAG minimum — 4.5 for text, 3 for UI/large */
  min: number;
  kind: "text" | "ui";
  /** true when fg or bg comes from the derived org palette */
  brandDependent: boolean;
}

export const CONTRAST_MANIFEST: ContrastPair[] = [
  /* ---- static (fixed per mode in semantic.css) ---- */
  { id: "body-on-bg", fg: "text", bg: "bg", min: 4.5, kind: "text", brandDependent: false },
  { id: "body-on-surface", fg: "text", bg: "surface", min: 4.5, kind: "text", brandDependent: false },
  { id: "secondary-on-bg", fg: "text-secondary", bg: "bg", min: 4.5, kind: "text", brandDependent: false },
  { id: "secondary-on-surface", fg: "text-secondary", bg: "surface", min: 4.5, kind: "text", brandDependent: false },
  { id: "muted-on-surface", fg: "text-muted", bg: "surface", min: 4.5, kind: "text", brandDependent: false },
  { id: "success-on-subtle", fg: "success-on", bg: "success-subtle", min: 4.5, kind: "text", brandDependent: false },
  { id: "warning-on-subtle", fg: "warning-on", bg: "warning-subtle", min: 4.5, kind: "text", brandDependent: false },
  { id: "danger-on-subtle", fg: "danger-on", bg: "danger-subtle", min: 4.5, kind: "text", brandDependent: false },
  { id: "info-on-subtle", fg: "info-on", bg: "info-subtle", min: 4.5, kind: "text", brandDependent: false },

  /* ---- brand-dependent (derived per org) ---- */
  { id: "on-brand", fg: "on-brand", bg: "brand", min: 4.5, kind: "text", brandDependent: true },
  { id: "brand-text-on-bg", fg: "brand", bg: "bg", min: 4.5, kind: "text", brandDependent: true },
  { id: "brand-text-on-surface", fg: "brand", bg: "surface", min: 4.5, kind: "text", brandDependent: true },
  { id: "brand-text-on-subtle", fg: "brand", bg: "brand-subtle", min: 4.5, kind: "text", brandDependent: true },
  { id: "focus-ring", fg: "focus", bg: "bg", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-1", fg: "chart-1", bg: "surface", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-2", fg: "chart-2", bg: "surface", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-3", fg: "chart-3", bg: "surface", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-4", fg: "chart-4", bg: "surface", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-5", fg: "chart-5", bg: "surface", min: 3, kind: "ui", brandDependent: true },
  { id: "chart-6", fg: "chart-6", bg: "surface", min: 3, kind: "ui", brandDependent: true },
];

/** Every semantic token that MUST exist in every mode (§2.4 completeness). */
export const EXPECTED_SEMANTIC_TOKENS = [
  "bg", "bg-subtle", "surface", "surface-raised", "surface-overlay",
  "text", "text-secondary", "text-muted", "text-inverse",
  "border", "border-strong",
  "brand", "brand-hover", "brand-active", "brand-subtle", "on-brand", "focus",
  "scrim",
  "success", "success-subtle", "success-on",
  "warning", "warning-subtle", "warning-on",
  "danger", "danger-subtle", "danger-on",
  "info", "info-subtle", "info-on",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6",
  "tutor-ring", "tutor-fab",
] as const;
