/**
 * Theme Module — Color math (REDESIGN-P2 §2.3)
 *
 * In-house OKLCH ↔ sRGB conversion, WCAG relative luminance and
 * contrast ratio. Zero dependencies, isomorphic (no DOM), used by:
 *   - brand.ts           (org palette derivation)
 *   - scripts/validate-theme.ts (CI contrast gate)
 *
 * This file is one of the only two places color literals/math may
 * live (the other being modules/theme/tokens/*). See token law, §2.1.
 */

export interface Oklch {
  /** OKLCH lightness 0..1 */
  l: number;
  /** chroma, typically 0..0.4 */
  c: number;
  /** hue in degrees 0..360 */
  h: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* ---------- hex <-> rgb ---------- */

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/* ---------- sRGB <-> linear ---------- */

const srgbToLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp(c, 0, 1);
};

/* ---------- WCAG luminance & contrast ---------- */

export function relativeLuminanceHex(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.x contrast ratio, 1..21 */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminanceHex(hexA);
  const lb = relativeLuminanceHex(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- sRGB <-> OKLab <-> OKLCH ---------- */

const M1 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const M1_INV = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
const M2 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const M2_INV = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

function mul3(m: number[][], x: number, y: number, z: number): [number, number, number] {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex);
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const [l0, m0, s0] = mul3(M1, lr, lg, lb);
  const l_ = Math.cbrt(l0);
  const m_ = Math.cbrt(m0);
  const s_ = Math.cbrt(s0);
  const [L, a, bb] = mul3(M2, l_, m_, s_);
  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: clamp(L, 0, 1), c, h };
}

function inGamut(r: number, g: number, b: number, eps = 0.0005): boolean {
  return [r, g, b].every((v) => v >= -eps && v <= 1 + eps);
}

/** OKLCH → sRGB hex. Out-of-gamut colors are pulled in by reducing
 *  chroma (bisection), preserving perceived hue + lightness. */
export function oklchToHex({ l, c, h }: Oklch): string {
  const L = clamp(l, 0, 1);
  let lo = 0;
  let hi = clamp(c, 0, 0.5);
  const render = (chroma: number): [number, number, number] => {
    const hRad = (h * Math.PI) / 180;
    const a = chroma * Math.cos(hRad);
    const bb = chroma * Math.sin(hRad);
    const [l_, m_, s_] = mul3(M2_INV, L, a, bb);
    const [l0, m0, s0] = mul3(M1_INV, l_ ** 3, m_ ** 3, s_ ** 3);
    return [linearToSrgb(l0), linearToSrgb(m0), linearToSrgb(s0)];
  };
  let rgb = render(hi);
  if (!inGamut(...rgb)) {
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(...render(mid))) lo = mid;
      else hi = mid;
    }
    rgb = render(lo);
  }
  return rgbToHex(...rgb);
}

/* ---------- helpers used by derivation & validation ---------- */

export function shiftOklch(color: Oklch, dl: number, dc = 0, dh = 0): Oklch {
  return {
    l: clamp(color.l + dl, 0, 1),
    c: clamp(color.c + dc, 0, 0.5),
    h: (color.h + dh + 360) % 360,
  };
}

/** Nudge lightness in `dir` direction until contrast against `bgHex`
 *  reaches `min` (WCAG guarantee loop, §2.3 rule 6 — max 6 steps). */
export function meetContrast(
  color: Oklch,
  bgHex: string,
  min: number,
  dir: 1 | -1,
  step = 0.025,
  maxSteps = 6
): Oklch {
  let cur = { ...color };
  for (let i = 0; i < maxSteps; i++) {
    if (contrastRatio(oklchToHex(cur), bgHex) >= min) return cur;
    cur = { ...cur, l: clamp(cur.l + dir * step, 0.02, 0.98) };
  }
  return cur;
}
