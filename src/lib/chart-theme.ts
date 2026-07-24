"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Chart color palettes for light and dark themes.
 * Mirrors the --chart-* / --border / --muted-foreground tokens in globals.css.
 * Recharts needs literal hex values — it can't read CSS variables.
 */
export interface ChartColors {
  /** Chart 1 — primary (blue) */
  chart1: string;
  /** Chart 2 — success (green) */
  chart2: string;
  /** Chart 3 — warning (yellow) */
  chart3: string;
  /** Chart 4 — danger (red) */
  chart4: string;
  /** Chart 5 — accent (purple) */
  chart5: string;
  /** Grid lines */
  grid: string;
  /** Axis text + tick labels */
  axis: string;
  /** Secondary axis / faded elements */
  axisFaded: string;
  /** Tooltip background */
  tooltipBg: string;
  /** Tooltip border */
  tooltipBorder: string;
  /** Tooltip text */
  tooltipText: string;
  /** Tooltip hover cursor fill */
  cursorFill: string;
}

const LIGHT: ChartColors = {
  chart1: "#1a73e8",
  chart2: "#34a853",
  chart3: "#fbbc04",
  chart4: "#ea4335",
  chart5: "#9334e8",
  grid: "#dadce0",
  axis: "#5f6368",
  axisFaded: "#9aa0a6",
  tooltipBg: "#ffffff",
  tooltipBorder: "#dadce0",
  tooltipText: "#202124",
  cursorFill: "#f1f3f4",
};

const DARK: ChartColors = {
  chart1: "#8ab4f8",
  chart2: "#81c995",
  chart3: "#fdd663",
  chart4: "#f28b82",
  chart5: "#c58af9",
  grid: "#5f6368",
  axis: "#9aa0a6",
  axisFaded: "#5f6368",
  tooltipBg: "#28292c",
  tooltipBorder: "#5f6368",
  tooltipText: "#e8eaed",
  cursorFill: "#3c4043",
};

/**
 * Hook that returns the correct chart color palette for the current theme.
 * Uses `resolvedTheme` from next-themes to pick light vs dark.
 * Defaults to light until mounted (avoids hydration mismatch).
 */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || resolvedTheme === "light") return LIGHT;
  if (resolvedTheme === "dark") return DARK;
  return LIGHT;
}

/** Shared tooltip style object — use in Recharts <Tooltip contentStyle={...} /> */
export function tooltipStyle(c: ChartColors) {
  return {
    background: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: "8px",
    color: c.tooltipText,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    fontSize: "12px",
    padding: "8px 12px",
  };
}
