"use client";

/**
 * Theme Module — Theme v2 Provider (REDESIGN-P2 §2.2, P5 W0)
 *
 * Source of truth for:
 *   html[data-mode="light|dark|bed"]  → tokens/semantic.css
 *   html[data-brand] + injected vars  → deriveBrandPalette (org brand)
 *
 * Strangulation contract:
 *   - next-themes stays the source of truth for light/dark/system and
 *     the legacy `.dark` class; we read from it, never fight it.
 *   - Bed mode layers ON dark: entering bed forces next-themes dark so
 *     legacy components fall back to their dark vars, while new tokens
 *     resolve the bed palette (higher specificity on data-mode).
 *   - One-time client-side preset migration (§2.5): the old
 *     "examiner-theme-preset" key becomes an org brand hex, then is
 *     deleted.
 *
 * FOUC guard: an inline script in the root layout sets data-mode from
 * the same storage keys before first paint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { deriveBrandPalette, paletteToCssVars, type BrandPalette } from "./lib/brand";

export type ThemeModeV2 = "light" | "dark" | "bed" | "classic" | "zinc" | "ocean" | "forest" | "sunset";

/** The original preset themes (re-added 2026-08-15 — user request:
 *  "restore all old color themes"). Each preset carries its own light +
 *  dark variant (dark layers via the .dark class). Zinc is the very
 *  first shadcn default; Modern Slate is the default light/dark. */
export const THEME_PRESET_MODES = ["zinc", "ocean", "forest", "sunset"] as const;
export type ThemePresetMode = (typeof THEME_PRESET_MODES)[number];

export const THEME_V2_STORAGE = {
  bed: "tx-theme-bed",
  classic: "tx-theme-classic",
  preset: "tx-theme-preset",
  brand: "tx-org-brand",
  legacyPreset: "examiner-theme-preset",
} as const;

const BRAND_STYLE_ID = "tx-brand-vars";

interface ThemeV2Value {
  /** Resolved mode currently applied to <html data-mode>. */
  mode: ThemeModeV2;
  bed: boolean;
  /** Classic mode (Star Admin vertical theme) — light, indigo brand. */
  classic: boolean;
  /** Layer bed mode over dark (or remove it). */
  setBed: (on: boolean) => void;
  /** Switch mode outright — the control the v2 shell uses. */
  setMode: (mode: ThemeModeV2) => void;
  /** Org brand hex, or null for the platform default brand. */
  brandHex: string | null;
  setBrandHex: (hex: string | null) => void;
  /** Derived palette for the current brand (null = default brand). */
  palette: BrandPalette | null;
  /** False until client storage has been read (SSR-safe rendering). */
  mounted: boolean;
}

const ThemeV2Context = createContext<ThemeV2Value | null>(null);

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function ThemeV2Provider({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [bed, setBedState] = useState(false);
  const [classic, setClassicState] = useState(false);
  const [preset, setPresetState] = useState<ThemePresetMode | null>(null);
  const [brandHex, setBrandHexState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  /* ---- boot: read storage, run one-time preset migration (§2.5) ---- */
  useEffect(() => {
    setBedState(readBool(THEME_V2_STORAGE.bed));
    setClassicState(readBool(THEME_V2_STORAGE.classic));
    try {
      const p = localStorage.getItem(THEME_V2_STORAGE.preset);
      if (p && (THEME_PRESET_MODES as readonly string[]).includes(p)) {
        setPresetState(p as ThemePresetMode);
      }
    } catch {
      /* non-fatal */
    }
    // W10: the legacy preset migration is gone with presets.ts — the
    // org/global brand key is the only source.
    const hex = localStorage.getItem(THEME_V2_STORAGE.brand);
    if (hex) setBrandHexState(hex);
    setMounted(true);
  }, []);

  const mode: ThemeModeV2 = classic
    ? "classic"
    : bed
      ? "bed"
      : preset
        ? preset
        : resolvedTheme === "dark"
          ? "dark"
          : "light";

  /* ---- apply data-mode (semantic tokens key off this) ---- */
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const setBed = useCallback(
    (on: boolean) => {
      setBedState(on);
      try {
        localStorage.setItem(THEME_V2_STORAGE.bed, on ? "1" : "0");
      } catch {
        /* non-fatal */
      }
      if (on) setTheme("dark"); // bed layers over dark for legacy fallback
    },
    [setTheme]
  );

  const setMode = useCallback(
    (next: ThemeModeV2) => {
      if (next === "classic") {
        // Classic layers over light for legacy fallback (like bed over dark).
        setClassicState(true);
        setBedState(false);
        setPresetState(null);
        setTheme("light");
        try {
          localStorage.setItem(THEME_V2_STORAGE.classic, "1");
          localStorage.removeItem(THEME_V2_STORAGE.preset);
        } catch {
          /* non-fatal */
        }
        return;
      }
      setClassicState(false);
      try {
        localStorage.setItem(THEME_V2_STORAGE.classic, "0");
      } catch {
        /* non-fatal */
      }
      if (next === "bed") {
        setBed(true);
        setPresetState(null);
        return;
      }
      setBed(false);
      if ((THEME_PRESET_MODES as readonly string[]).includes(next)) {
        // Original v1 preset — keeps its own light/dark via the normal
        // light/dark toggle (data-mode stays the preset, .dark layers on).
        setPresetState(next as ThemePresetMode);
        try {
          localStorage.setItem(THEME_V2_STORAGE.preset, next);
        } catch {
          /* non-fatal */
        }
        return;
      }
      setPresetState(null);
      try {
        localStorage.removeItem(THEME_V2_STORAGE.preset);
      } catch {
        /* non-fatal */
      }
      setTheme(next);
    },
    [setBed, setTheme]
  );

  /* ---- org brand: derive palette, inject vars on html[data-brand] ---- */
  const palette = useMemo(() => (brandHex ? deriveBrandPalette(brandHex) : null), [brandHex]);

  useEffect(() => {
    const root = document.documentElement;
    const existing = document.getElementById(BRAND_STYLE_ID);
    if (!brandHex || !palette) {
      root.removeAttribute("data-brand");
      existing?.remove();
      return;
    }
    root.dataset.brand = "custom";
    let styleEl = existing as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = BRAND_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    // Specificity 0-2-1 beats the semantic mode selectors (0-1-1).
    styleEl.textContent = `
html[data-brand][data-mode="light"], html[data-brand]:not([data-mode]) {
  ${paletteToCssVars(palette.light)}
}
html[data-brand][data-mode="dark"] {
  ${paletteToCssVars(palette.dark)}
}
html[data-brand][data-mode="bed"] {
  ${paletteToCssVars(palette.bed)}
}
html[data-brand][data-mode="classic"] {
  ${paletteToCssVars(palette.light)}
}
html[data-brand][data-mode="zinc"], html[data-brand][data-mode="ocean"], html[data-brand][data-mode="forest"], html[data-brand][data-mode="sunset"] {
  ${paletteToCssVars(palette.light)}
}
html[data-brand][data-mode="zinc"].dark, html[data-brand][data-mode="ocean"].dark, html[data-brand][data-mode="forest"].dark, html[data-brand][data-mode="sunset"].dark {
  ${paletteToCssVars(palette.dark)}
}`;
  }, [brandHex, palette]);

  const setBrandHex = useCallback((hex: string | null) => {
    setBrandHexState(hex);
    try {
      if (hex) localStorage.setItem(THEME_V2_STORAGE.brand, hex);
      else localStorage.removeItem(THEME_V2_STORAGE.brand);
    } catch {
      /* non-fatal */
    }
  }, []);

  const value = useMemo<ThemeV2Value>(
    () => ({ mode, bed, classic, setBed, setMode, brandHex, setBrandHex, palette, mounted }),
    [mode, bed, classic, setBed, setMode, brandHex, setBrandHex, palette, mounted]
  );

  return <ThemeV2Context.Provider value={value}>{children}</ThemeV2Context.Provider>;
}

export function useThemeV2(): ThemeV2Value {
  const ctx = useContext(ThemeV2Context);
  if (!ctx) {
    // Outside the provider (e.g. isolated pages) — safe defaults.
    return {
      mode: "light",
      bed: false,
      classic: false,
      setBed: () => {},
      setMode: () => {},
      brandHex: null,
      setBrandHex: () => {},
      palette: null,
      mounted: false,
    };
  }
  return ctx;
}
