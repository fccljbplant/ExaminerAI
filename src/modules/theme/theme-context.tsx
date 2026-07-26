"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { THEME_PRESETS, DEFAULT_THEME_ID, getThemePreset, type ThemeColors, type ThemePreset } from "./themes/presets";

/**
 * Theme Module — Global theme system for ExaminerAI.
 *
 * This module provides:
 *   1. Multiple preset themes (Modern Slate, Ocean Blue, Forest Sage, Sunset Rose)
 *   2. A React context that applies CSS variables dynamically
 *   3. Persistence via localStorage
 *   4. Integration with next-themes for light/dark mode
 *
 * Usage:
 *   <ThemeProvider> wraps the app (already in layout.tsx)
 *   useThemePreset() returns { preset, setPresetId, presets }
 *   <PresetThemeToggle /> renders a dropdown to switch presets
 *
 * To apply the theme globally, CSS variables are written to :root and .dark
 * at runtime. The globals.css file also defines fallback values matching
 * the default "modern" preset.
 */

interface ThemeContextValue {
  /** The currently active theme preset */
  preset: ThemePreset;
  /** All available presets (for the picker) */
  presets: ThemePreset[];
  /** Change the active preset by ID */
  setPresetId: (id: string) => void;
  /** Current preset ID */
  presetId: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "examiner-theme-preset";

/** Convert a ThemeColors object into CSS custom property declarations. */
function colorsToCssVars(colors: ThemeColors): string {
  const map: Record<keyof ThemeColors, string> = {
    background: "--background",
    foreground: "--foreground",
    card: "--card",
    cardForeground: "--card-foreground",
    popover: "--popover",
    popoverForeground: "--popover-foreground",
    primary: "--primary",
    primaryForeground: "--primary-foreground",
    secondary: "--secondary",
    secondaryForeground: "--secondary-foreground",
    muted: "--muted",
    mutedForeground: "--muted-foreground",
    accent: "--accent",
    accentForeground: "--accent-foreground",
    destructive: "--destructive",
    destructiveForeground: "--destructive-foreground",
    border: "--border",
    input: "--input",
    ring: "--ring",
    chart1: "--chart-1",
    chart2: "--chart-2",
    chart3: "--chart-3",
    chart4: "--chart-4",
    chart5: "--chart-5",
    sidebar: "--sidebar",
    sidebarForeground: "--sidebar-foreground",
    sidebarPrimary: "--sidebar-primary",
    sidebarPrimaryForeground: "--sidebar-primary-foreground",
    sidebarAccent: "--sidebar-accent",
    sidebarAccentForeground: "--sidebar-accent-foreground",
    sidebarBorder: "--sidebar-border",
    sidebarRing: "--sidebar-ring",
  };
  return Object.entries(map)
    .map(([key, varName]) => `${varName}: ${(colors as any)[key]};`)
    .join("\n  ");
}

/** Inject the theme CSS variables into the document head. */
function applyTheme(preset: ThemePreset) {
  const styleId = "examiner-theme-vars";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
:root {
  ${colorsToCssVars(preset.light)}
}
.dark {
  ${colorsToCssVars(preset.dark)}
}
`;
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetIdState] = useState<string>(DEFAULT_THEME_ID);

  // Load saved preset on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_PRESETS.find((t) => t.id === saved)) {
      setPresetIdState(saved);
    }
  }, []);

  // Apply theme whenever preset changes
  useEffect(() => {
    const preset = getThemePreset(presetId);
    applyTheme(preset);
  }, [presetId]);

  const setPresetId = useCallback((id: string) => {
    setPresetIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const preset = getThemePreset(presetId);

  return (
    <ThemeContext.Provider value={{ preset, presets: THEME_PRESETS, setPresetId, presetId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreset(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components outside the provider — return default theme
    return {
      preset: getThemePreset(DEFAULT_THEME_ID),
      presets: THEME_PRESETS,
      setPresetId: () => {},
      presetId: DEFAULT_THEME_ID,
    };
  }
  return ctx;
}
