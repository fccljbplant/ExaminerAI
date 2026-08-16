/**
 * Theme Module — Validation logic (REDESIGN-P2 §2.4)
 *
 * Pure, isomorphic-ish (node fs) validation of the theme system:
 *  1. Completeness — every semantic token defined in every mode.
 *  2. Static contrast — non-brand manifest pairs vs semantic.css values.
 *  3. Derived contrast — default brand + 12 sampled hues + edge hues
 *     (yellow / near-white / near-black) in every mode.
 *  4. Built-CSS integrity — every var(--x) in compiled CSS is defined
 *     (opt-in; needs a .next build).
 *
 * Entry points:
 *  - scripts/validate-theme.ts      (CLI gate)
 *  - src/modules/theme/lib/validate.test.ts (vitest gate, `npm run theme:validate`)
 */

import fs from "node:fs";
import path from "node:path";
import { contrastRatio, oklchToHex, type Oklch } from "./color";
import {
  DEFAULT_BRAND_OKLCH,
  deriveBrandPalette,
  type BrandPaletteMode,
} from "./brand";
import {
  CONTRAST_MANIFEST,
  EXPECTED_SEMANTIC_TOKENS,
  type ThemeMode,
} from "./contrast-manifest";

const MODES: ThemeMode[] = ["light", "dark", "bed"];

export interface ValidationResult {
  checks: number;
  failures: string[];
  brandsTested: number;
}

export interface ValidationOptions {
  /** repo root; defaults to process.cwd() */
  root?: string;
  /** scan .next/static CSS for dangling var() references */
  includeBuiltCss?: boolean;
}

type TokenMap = Record<string, string>; // token name → hex

/* ---------- parsing ---------- */

function parseOklch(value: string): Oklch | null {
  // Optional alpha channel is accepted but ignored — translucency is
  // irrelevant to contrast here (no manifest pair uses --scrim).
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)/);
  if (!m) return null;
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
}

function parseSemanticCss(css: string): Record<ThemeMode, TokenMap> {
  const out: Record<ThemeMode, TokenMap> = { light: {}, dark: {}, bed: {} };
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(stripped))) {
    const selectors = block[1].split(",").map((s) => s.trim());
    const modes = new Set<ThemeMode>();
    for (const sel of selectors) {
      if (sel.includes('data-mode="dark"')) modes.add("dark");
      else if (sel.includes('data-mode="bed"')) modes.add("bed");
      else if (sel === ":root" || sel.includes('data-mode="light"')) modes.add("light");
    }
    const declRe = /--([\w-]+)\s*:\s*([^;]+);/g;
    let decl: RegExpExecArray | null;
    while ((decl = declRe.exec(block[2]))) {
      const value = decl[2].trim();
      // Values may be hex (#rrggbb — the restored v1 preset palettes) or
      // oklch(...) (the native v2 modes).
      let hex: string | null = null;
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        hex = value.toLowerCase();
      } else {
        const oklch = parseOklch(value);
        if (oklch) hex = oklchToHex(oklch);
      }
      if (!hex) continue;
      for (const mode of modes) out[mode][decl[1]] = hex;
    }
  }
  return out;
}

/* ---------- sample brands ---------- */

export function sampleBrands(): { name: string; hex: string }[] {
  return [
    { name: "default", hex: oklchToHex(DEFAULT_BRAND_OKLCH) },
    ...Array.from({ length: 12 }, (_, i) => ({
      name: `hue-${i * 30}`,
      hex: oklchToHex({ l: 0.5, c: 0.12, h: i * 30 }),
    })),
    { name: "edge-yellow", hex: "#facc15" },
    { name: "edge-near-white", hex: "#f8fafc" },
    { name: "edge-near-black", hex: "#0b0b0e" },
  ];
}

function derivedTokenMap(palette: BrandPaletteMode): TokenMap {
  return {
    brand: palette.brand,
    "brand-hover": palette.brandHover,
    "brand-active": palette.brandActive,
    "brand-subtle": palette.brandSubtle,
    "on-brand": palette.onBrand,
    focus: palette.focus,
    "tutor-ring": palette.focus,
    "tutor-fab": palette.brand,
    ...Object.fromEntries(palette.charts.map((c, i) => [`chart-${i + 1}`, c])),
  };
}

/* ---------- built-CSS integrity ---------- */

function checkBuiltCssVars(root: string): { checks: number; failures: string[] } {
  const result = { checks: 0, failures: [] as string[] };
  const staticDir = path.join(root, ".next", "static");
  if (!fs.existsSync(staticDir)) return result;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".css")) files.push(p);
    }
  };
  walk(staticDir);
  const defined = new Set<string>();
  const referenced = new Set<string>();
  for (const f of files) {
    const css = fs.readFileSync(f, "utf8");
    for (const m of css.matchAll(/--([\w-]+)\s*:/g)) defined.add(m[1]);
    for (const m of css.matchAll(/var\(\s*--([\w-]+)\s*(,[^)]*)?\)/g)) {
      if (!m[2]) referenced.add(m[1]); // fallbacks are self-healing
    }
  }
  for (const ref of referenced) {
    result.checks++;
    if (!defined.has(ref)) result.failures.push(`[built-css] var(--${ref}) referenced but never defined`);
  }
  return result;
}

/* ---------- main ---------- */

export function runThemeValidation(opts: ValidationOptions = {}): ValidationResult {
  const root = opts.root ?? process.cwd();
  const failures: string[] = [];
  let checks = 0;

  const assertPair = (
    label: string,
    mode: ThemeMode,
    pairId: string,
    fg: string | undefined,
    bg: string | undefined,
    min: number
  ) => {
    checks++;
    if (!fg || !bg) {
      failures.push(`[${label}/${mode}] ${pairId}: unresolved token (fg=${fg} bg=${bg})`);
      return;
    }
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) {
      failures.push(`[${label}/${mode}] ${pairId}: ${ratio.toFixed(2)} < ${min} (fg=${fg} bg=${bg})`);
    }
  };

  const css = fs.readFileSync(path.join(root, "src/modules/theme/tokens/semantic.css"), "utf8");
  const tokens = parseSemanticCss(css);

  // 1. completeness
  for (const mode of MODES) {
    for (const token of EXPECTED_SEMANTIC_TOKENS) {
      checks++;
      if (!tokens[mode][token]) failures.push(`[completeness/${mode}] missing token --${token}`);
    }
  }

  // 2. static pairs
  for (const pair of CONTRAST_MANIFEST.filter((p) => !p.brandDependent)) {
    for (const mode of MODES) {
      assertPair("static", mode, pair.id, tokens[mode][pair.fg], tokens[mode][pair.bg], pair.min);
    }
  }

  // 3. derived pairs — default + 12 hues + edge hues, every mode
  const brands = sampleBrands();
  for (const sample of brands) {
    const palette = deriveBrandPalette(sample.hex);
    for (const mode of MODES) {
      const derived = derivedTokenMap(palette[mode]);
      const resolve = (name: string) => derived[name] ?? tokens[mode][name];
      for (const pair of CONTRAST_MANIFEST.filter((p) => p.brandDependent)) {
        assertPair(`brand:${sample.name}`, mode, pair.id, resolve(pair.fg), resolve(pair.bg), pair.min);
      }
    }
  }

  // 4. built-CSS integrity (opt-in; needs a build)
  if (opts.includeBuiltCss) {
    const built = checkBuiltCssVars(root);
    checks += built.checks;
    failures.push(...built.failures);
  }

  return { checks, failures, brandsTested: brands.length };
}
