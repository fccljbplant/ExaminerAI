/**
 * Theme Module — Org brand derivation (REDESIGN-P2 §2.3)
 *
 * One org color in → full WCAG-AA palette out. In-house OKLCH math,
 * no external services. The theme v2 provider injects the result as
 * CSS vars on html[data-brand]; scripts/validate-theme.ts re-verifies
 * every pair in CI.
 *
 * Rules implemented (§2.3):
 *  1. Keep input hue; clamp chroma to [0.06, 0.16].
 *  2. Light --brand starts L 0.5, dark/bed L 0.75, then the WCAG
 *     guarantee loop (§2.3.6, ≤6 steps) adjusts L until all text
 *     pairs pass 4.5:1.
 *  3. brand-subtle L 0.94 light / 0.25 dark-family; hover/active ∓L.
 *  4. Status colors are NEVER derived here (fixed in semantic.css).
 *  5. Chart hues H, H+40, H+150, H+210, H+300 (+1 neutral series),
 *     mode-tuned L/C; bed chroma ×0.6.
 */

import {
  contrastRatio,
  hexToOklch,
  meetContrast,
  oklchToHex,
  shiftOklch,
  type Oklch,
} from "./color";

export interface BrandPaletteMode {
  brand: string;
  brandHover: string;
  brandActive: string;
  brandSubtle: string;
  onBrand: string;
  focus: string;
  /** 6 chart series */
  charts: readonly [string, string, string, string, string, string];
}

export interface BrandPalette {
  light: BrandPaletteMode;
  dark: BrandPaletteMode;
  bed: BrandPaletteMode;
}

/** Must match tokens/semantic.css mode backgrounds/surfaces. */
const MODE_REFS = {
  light: { bg: oklchToHex({ l: 0.985, c: 0, h: 0 }), surface: "#ffffff" },
  dark: {
    bg: oklchToHex({ l: 0.185, c: 0.015, h: 270 }),
    surface: oklchToHex({ l: 0.235, c: 0.015, h: 270 }),
  },
  bed: {
    bg: oklchToHex({ l: 0.16, c: 0.02, h: 60 }),
    surface: oklchToHex({ l: 0.2, c: 0.025, h: 60 }),
  },
} as const;

/** Default brand when an org has none (mirrors semantic.css default). */
export const DEFAULT_BRAND_OKLCH: Oklch = { l: 0.5, c: 0.12, h: 62 };

const CHART_HUE_OFFSETS = [0, 40, 150, 210, 300] as const;

function chartsFor(base: Oklch, mode: "light" | "dark" | "bed", surfaceHex: string): BrandPaletteMode["charts"] {
  const tuning = {
    light: { l: 0.62, maxC: 0.15, dir: -1 as const, chromaScale: 1 },
    dark: { l: 0.74, maxC: 0.13, dir: 1 as const, chromaScale: 1 },
    bed: { l: 0.68, maxC: 0.09, dir: 1 as const, chromaScale: 0.6 },
  }[mode];

  const series = [...CHART_HUE_OFFSETS.map((d) => shiftOklch(base, 0, 0, d)), { ...base }];
  const [c1, c2, c3, c4, c5, c6] = series.map((hColor, i) => {
    const isNeutralSeries = i === series.length - 1;
    let c = Math.min(tuning.maxC, Math.max(0.04, hColor.c) * tuning.chromaScale);
    if (isNeutralSeries) c = Math.min(c, 0.03); // muted reference series
    const start: Oklch = { l: tuning.l, c, h: hColor.h };
    // Charts are UI/large: 3:1 against their surface (§2.4).
    return oklchToHex(meetContrast(start, surfaceHex, 3, tuning.dir, 0.02));
  });
  return [c1, c2, c3, c4, c5, c6];
}

function deriveMode(base: Oklch, mode: "light" | "dark" | "bed"): BrandPaletteMode {
  const refs = MODE_REFS[mode];
  const isLight = mode === "light";

  // 2. brand start point + WCAG guarantee loop against the mode bg
  //    (brand doubles as link/accent TEXT on bg, so 4.5 not 3).
  let brand = isLight ? { ...base, l: 0.5 } : { ...base, l: 0.75 };
  brand = meetContrast(brand, refs.bg, 4.5, isLight ? -1 : 1, 0.025);

  // on-brand: white when the fill is dark enough, near-black otherwise.
  // If NEITHER passes (rare mid-grey input), darken the fill until white
  // passes — the guarantee loop (§2.3.6) keeps this ≤6 steps.
  const white = "#ffffff";
  const nearBlack = oklchToHex({ l: 0.16, c: 0.02, h: base.h });
  let onBrand = contrastRatio(oklchToHex(brand), white) >= 4.5 ? white : nearBlack;
  if (contrastRatio(oklchToHex(brand), onBrand) < 4.5) {
    brand = meetContrast(brand, white, 4.5, -1, 0.05);
    onBrand = white;
  }

  return deriveWithBrand(brand, base, mode);
}

function deriveWithBrand(brand: Oklch, base: Oklch, mode: "light" | "dark" | "bed"): BrandPaletteMode {
  const refs = MODE_REFS[mode];
  const isLight = mode === "light";
  const brandHex = oklchToHex(brand);

  // 3. states + subtle tint
  const hover = shiftOklch(brand, isLight ? -0.05 : 0.05);
  const active = shiftOklch(brand, isLight ? -0.08 : -0.05);
  const subtle: Oklch = isLight
    ? { l: 0.94, c: Math.min(base.c, 0.05), h: base.h }
    : { l: 0.25, c: Math.min(base.c, 0.05), h: base.h };
  // brand text on subtle tint must read (used for active tabs/chips)
  const subtleSafe = meetContrast(subtle, brandHex, 4.5, isLight ? 1 : -1, 0.02);

  const white = "#ffffff";
  const nearBlack = oklchToHex({ l: 0.16, c: 0.02, h: base.h });
  const onBrand = contrastRatio(brandHex, white) >= 4.5 ? white : nearBlack;

  return {
    brand: brandHex,
    brandHover: oklchToHex(hover),
    brandActive: oklchToHex(active),
    brandSubtle: oklchToHex(subtleSafe),
    onBrand,
    focus: brandHex,
    charts: chartsFor(base, mode, refs.surface),
  };
}

/** Derive the full light/dark/bed palette from a single org hex. */
export function deriveBrandPalette(hex: string): BrandPalette {
  const ok = hexToOklch(hex);
  // 1. keep hue, clamp chroma into the accessible band
  const base: Oklch = { l: ok.l, c: Math.min(0.16, Math.max(0.06, ok.c)), h: ok.h };
  return {
    light: deriveMode(base, "light"),
    dark: deriveMode(base, "dark"),
    bed: deriveMode(base, "bed"),
  };
}

/** Serialize a palette into CSS custom-property declarations for the
 *  provider's <style> injection (scoped to html[data-brand]). */
export function paletteToCssVars(palette: BrandPaletteMode): string {
  return [
    `--brand: ${palette.brand};`,
    `--brand-hover: ${palette.brandHover};`,
    `--brand-active: ${palette.brandActive};`,
    `--brand-subtle: ${palette.brandSubtle};`,
    `--on-brand: ${palette.onBrand};`,
    `--focus: ${palette.focus};`,
    `--tutor-ring: ${palette.focus};`,
    `--tutor-fab: ${palette.brand};`,
    ...palette.charts.map((c, i) => `--chart-${i + 1}: ${c};`),
  ].join("\n  ");
}
