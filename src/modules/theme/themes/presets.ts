/**
 * Theme preset definitions for TraineesAI.
 *
 * Each preset is a complete set of CSS custom properties (variables) that
 * get applied to :root (light) and .dark (dark) at runtime.
 *
 * To add a new theme: create an object matching ThemePreset, add it to the
 * THEME_PRESETS array, and it automatically appears in the theme picker.
 */

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Brand accent color — used for highlights, CTAs, focus rings */
  accentColor: string;
  light: ThemeColors;
  dark: ThemeColors;
}

// ============================================================
// MODERN (default) — Slate + Amber
// Clean, professional, matches the marketing landing page.
// Dark slate primary, warm amber accents, generous whitespace.
// ============================================================
const modern: ThemePreset = {
  id: "modern",
  name: "Modern Slate",
  description: "Slate-900 primary with warm amber accents. Clean and professional.",
  accentColor: "#f59e0b",
  light: {
    background: "#fafafa",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    popover: "#ffffff",
    popoverForeground: "#0f172a",
    primary: "#0f172a",
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9",
    secondaryForeground: "#0f172a",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    accent: "#fef3c7",
    accentForeground: "#92400e",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#e2e8f0",
    input: "#e2e8f0",
    ring: "#f59e0b",
    chart1: "#f59e0b",
    chart2: "#10b981",
    chart3: "#3b82f6",
    chart4: "#ef4444",
    chart5: "#8b5cf6",
    sidebar: "#ffffff",
    sidebarForeground: "#0f172a",
    sidebarPrimary: "#0f172a",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#f1f5f9",
    sidebarAccentForeground: "#0f172a",
    sidebarBorder: "#e2e8f0",
    sidebarRing: "#f59e0b",
  },
  dark: {
    background: "#0a0a0f",
    foreground: "#fafafa",
    card: "#16161f",
    cardForeground: "#fafafa",
    popover: "#1c1c28",
    popoverForeground: "#fafafa",
    primary: "#fbbf24",
    primaryForeground: "#0a0a0f",
    secondary: "#26263a",
    secondaryForeground: "#e5e7eb",
    muted: "#1c1c28",
    mutedForeground: "#9ca3af",
    accent: "#3d2e0e",
    accentForeground: "#fbbf24",
    destructive: "#f87171",
    destructiveForeground: "#0a0a0f",
    border: "#2a2a3a",
    input: "#2a2a3a",
    ring: "#fbbf24",
    chart1: "#fbbf24",
    chart2: "#34d399",
    chart3: "#60a5fa",
    chart4: "#f472b6",
    chart5: "#a78bfa",
    sidebar: "#0f0f17",
    sidebarForeground: "#fafafa",
    sidebarPrimary: "#fbbf24",
    sidebarPrimaryForeground: "#0a0a0f",
    sidebarAccent: "#26263a",
    sidebarAccentForeground: "#fafafa",
    sidebarBorder: "#2a2a3a",
    sidebarRing: "#fbbf24",
  },
};

// ============================================================
// OCEAN — Blue + Teal (NotebookLM-inspired, refreshed)
// ============================================================
const ocean: ThemePreset = {
  id: "ocean",
  name: "Ocean Blue",
  description: "Classic Google-blue with teal accents. NotebookLM-inspired.",
  accentColor: "#1a73e8",
  light: {
    background: "#f8f9fa",
    foreground: "#202124",
    card: "#ffffff",
    cardForeground: "#202124",
    popover: "#ffffff",
    popoverForeground: "#202124",
    primary: "#1a73e8",
    primaryForeground: "#ffffff",
    secondary: "#e8f0fe",
    secondaryForeground: "#1967d2",
    muted: "#f1f3f4",
    mutedForeground: "#5f6368",
    accent: "#e8f0fe",
    accentForeground: "#1967d2",
    destructive: "#d93025",
    destructiveForeground: "#ffffff",
    border: "#dadce0",
    input: "#dadce0",
    ring: "#1a73e8",
    chart1: "#1a73e8",
    chart2: "#34a853",
    chart3: "#fbbc04",
    chart4: "#ea4335",
    chart5: "#9334e8",
    sidebar: "#ffffff",
    sidebarForeground: "#202124",
    sidebarPrimary: "#1a73e8",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#e8f0fe",
    sidebarAccentForeground: "#1967d2",
    sidebarBorder: "#dadce0",
    sidebarRing: "#1a73e8",
  },
  dark: {
    background: "#1e1f20",
    foreground: "#e8eaed",
    card: "#28292c",
    cardForeground: "#e8eaed",
    popover: "#28292c",
    popoverForeground: "#e8eaed",
    primary: "#8ab4f8",
    primaryForeground: "#1e1f20",
    secondary: "#3c4043",
    secondaryForeground: "#8ab4f8",
    muted: "#3c4043",
    mutedForeground: "#9aa0a6",
    accent: "#3c4043",
    accentForeground: "#8ab4f8",
    destructive: "#f28b82",
    destructiveForeground: "#1e1f20",
    border: "#5f6368",
    input: "#5f6368",
    ring: "#8ab4f8",
    chart1: "#8ab4f8",
    chart2: "#81c995",
    chart3: "#fdd663",
    chart4: "#f28b82",
    chart5: "#c58af9",
    sidebar: "#28292c",
    sidebarForeground: "#e8eaed",
    sidebarPrimary: "#8ab4f8",
    sidebarPrimaryForeground: "#1e1f20",
    sidebarAccent: "#3c4043",
    sidebarAccentForeground: "#8ab4f8",
    sidebarBorder: "#5f6368",
    sidebarRing: "#8ab4f8",
  },
};

// ============================================================
// FOREST — Sage + Earth tones (warm, growth-oriented)
// ============================================================
const forest: ThemePreset = {
  id: "forest",
  name: "Forest Sage",
  description: "Calming sage greens with warm earth tones. Growth-oriented.",
  accentColor: "#5b8a72",
  light: {
    background: "#f7f8f5",
    foreground: "#1a2e22",
    card: "#ffffff",
    cardForeground: "#1a2e22",
    popover: "#ffffff",
    popoverForeground: "#1a2e22",
    primary: "#2f5d4a",
    primaryForeground: "#ffffff",
    secondary: "#d8ebe0",
    secondaryForeground: "#2f5d4a",
    muted: "#eef2ed",
    mutedForeground: "#5a6b5f",
    accent: "#fbe8c4",
    accentForeground: "#6b4a14",
    destructive: "#c0392b",
    destructiveForeground: "#ffffff",
    border: "#d4dccd",
    input: "#d4dccd",
    ring: "#5b8a72",
    chart1: "#5b8a72",
    chart2: "#c98a2b",
    chart3: "#3b82f6",
    chart4: "#d97766",
    chart5: "#8b5cf6",
    sidebar: "#ffffff",
    sidebarForeground: "#1a2e22",
    sidebarPrimary: "#2f5d4a",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#d8ebe0",
    sidebarAccentForeground: "#2f5d4a",
    sidebarBorder: "#d4dccd",
    sidebarRing: "#5b8a72",
  },
  dark: {
    background: "#1a2e22",
    foreground: "#e8f0ea",
    card: "#243528",
    cardForeground: "#e8f0ea",
    popover: "#243528",
    popoverForeground: "#e8f0ea",
    primary: "#7ab896",
    primaryForeground: "#1a2e22",
    secondary: "#2d4234",
    secondaryForeground: "#7ab896",
    muted: "#2d4234",
    mutedForeground: "#8fa395",
    accent: "#3d2e0e",
    accentForeground: "#fbbf24",
    destructive: "#f87171",
    destructiveForeground: "#1a2e22",
    border: "#3d5240",
    input: "#3d5240",
    ring: "#7ab896",
    chart1: "#7ab896",
    chart2: "#fbbf24",
    chart3: "#60a5fa",
    chart4: "#f87171",
    chart5: "#a78bfa",
    sidebar: "#243528",
    sidebarForeground: "#e8f0ea",
    sidebarPrimary: "#7ab896",
    sidebarPrimaryForeground: "#1a2e22",
    sidebarAccent: "#2d4234",
    sidebarAccentForeground: "#7ab896",
    sidebarBorder: "#3d5240",
    sidebarRing: "#7ab896",
  },
};

// ============================================================
// SUNSET — Rose + Amber (warm, energetic)
// ============================================================
const sunset: ThemePreset = {
  id: "sunset",
  name: "Sunset Rose",
  description: "Warm rose and amber gradients. Energetic and creative.",
  accentColor: "#e11d48",
  light: {
    background: "#fefcfd",
    foreground: "#1f1916",
    card: "#ffffff",
    cardForeground: "#1f1916",
    popover: "#ffffff",
    popoverForeground: "#1f1916",
    primary: "#9f1239",
    primaryForeground: "#ffffff",
    secondary: "#ffe4e6",
    secondaryForeground: "#9f1239",
    muted: "#fef2f4",
    mutedForeground: "#6b5b54",
    accent: "#fef3c7",
    accentForeground: "#92400e",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#fecdd3",
    input: "#fecdd3",
    ring: "#e11d48",
    chart1: "#e11d48",
    chart2: "#f59e0b",
    chart3: "#8b5cf6",
    chart4: "#10b981",
    chart5: "#3b82f6",
    sidebar: "#ffffff",
    sidebarForeground: "#1f1916",
    sidebarPrimary: "#9f1239",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#ffe4e6",
    sidebarAccentForeground: "#9f1239",
    sidebarBorder: "#fecdd3",
    sidebarRing: "#e11d48",
  },
  dark: {
    background: "#1a0f12",
    foreground: "#fce7eb",
    card: "#2a171c",
    cardForeground: "#fce7eb",
    popover: "#2a171c",
    popoverForeground: "#fce7eb",
    primary: "#fb7185",
    primaryForeground: "#1a0f12",
    secondary: "#3d2330",
    secondaryForeground: "#fb7185",
    muted: "#3d2330",
    mutedForeground: "#b89aa0",
    accent: "#422006",
    accentForeground: "#fbbf24",
    destructive: "#f87171",
    destructiveForeground: "#1a0f12",
    border: "#4d2d3a",
    input: "#4d2d3a",
    ring: "#fb7185",
    chart1: "#fb7185",
    chart2: "#fbbf24",
    chart3: "#a78bfa",
    chart4: "#34d399",
    chart5: "#60a5fa",
    sidebar: "#2a171c",
    sidebarForeground: "#fce7eb",
    sidebarPrimary: "#fb7185",
    sidebarPrimaryForeground: "#1a0f12",
    sidebarAccent: "#3d2330",
    sidebarAccentForeground: "#fb7185",
    sidebarBorder: "#4d2d3a",
    sidebarRing: "#fb7185",
  },
};

export const THEME_PRESETS: ThemePreset[] = [modern, ocean, forest, sunset];

export const DEFAULT_THEME_ID = "modern";

export function getThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0];
}
