"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeV2, type ThemeModeV2 } from "@/modules/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";

/**
 * modules/shell — UnifiedThemeToggle (2026-08-15)
 *
 * The OLD version's theme selector, copied onto the v2 theme engine:
 * a single palette button in the top bar — with a small dot showing the
 * current accent — opening a dropdown with:
 *
 *   1. Mode    — Light / Dark / Auto (system)
 *   2. Theme   — preset rows with overlapping swatches (light primary,
 *                dark primary, accent), name, description, and a check
 *                on the active theme.
 *
 * Theme presets are the restored v1 set: Modern Slate (default),
 * Ocean, Forest, Sunset — plus Bed and Classic from the v2 engine.
 */

interface ThemeRow {
  label: string;
  desc: string;
  swatches: { light: string; dark: string; accent: string };
  active: (mode: ThemeModeV2) => boolean;
  apply: () => void;
}

export function UnifiedThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { mode, setMode, mounted } = useThemeV2();
  const [localMounted, setLocalMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalMounted(true);
  }, []);

  const rows: ThemeRow[] = [
    {
      label: "Modern Slate",
      desc: "v1 default — slate + amber",
      swatches: { light: "#0F172A", dark: "#FBBF24", accent: "#F59E0B" },
      active: (m) => m === "light" || m === "dark",
      // Keeps the current light/dark variant while clearing any preset.
      apply: () => setMode(resolvedTheme === "dark" ? "dark" : "light"),
    },
    {
      label: "Ocean",
      desc: "v1 preset — blue + teal",
      swatches: { light: "#1A73E8", dark: "#8AB4F8", accent: "#1A73E8" },
      active: (m) => m === "ocean",
      apply: () => setMode("ocean"),
    },
    {
      label: "Forest",
      desc: "v1 preset — sage greens",
      swatches: { light: "#2F5D4A", dark: "#7AB896", accent: "#5B8A72" },
      active: (m) => m === "forest",
      apply: () => setMode("forest"),
    },
    {
      label: "Sunset",
      desc: "v1 preset — rose + amber",
      swatches: { light: "#9F1239", dark: "#FB7185", accent: "#E11D48" },
      active: (m) => m === "sunset",
      apply: () => setMode("sunset"),
    },
    {
      label: "Bed",
      desc: "Warm dimmed night mode",
      swatches: { light: "#F7F2E9", dark: "#201B14", accent: "#D9A34A" },
      active: (m) => m === "bed",
      apply: () => setMode("bed"),
    },
    {
      label: "Classic",
      desc: "Star Admin — indigo sidebar",
      swatches: { light: "#1F3BB3", dark: "#1F3BB3", accent: "#05C3FB" },
      active: (m) => m === "classic",
      apply: () => setMode("classic"),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Theme"
          title="Theme"
          className={cn(
            "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg",
            "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
            className
          )}
        >
          <Palette className="h-4.5 w-4.5" aria-hidden />
          {/* Accent dot — mirrors the active theme's brand color. */}
          {mounted && (
            <span
              aria-hidden
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-surface"
              style={{ backgroundColor: "var(--brand)" }}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-fg-muted">
          Appearance
        </DropdownMenuLabel>

        {/* Mode — Light / Dark / Auto */}
        <div className="px-2 py-1.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            Mode
          </p>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { key: "light", label: "Light", icon: Sun },
                { key: "dark", label: "Dark", icon: Moon },
                { key: "system", label: "Auto", icon: Monitor },
              ] as const
            ).map((m) => {
              const active = theme === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setTheme(m.key)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-8 items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition-colors",
                    "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                    active
                      ? "bg-brand text-on-brand"
                      : "border border-line bg-surface text-fg-secondary hover:bg-bg-subtle hover:text-fg"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Theme presets — the old swatch rows */}
        <div className="px-2 py-1.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            Theme
          </p>
          <div className="space-y-0.5">
            {rows.map((p) => {
              const active = p.active(mode);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={p.apply}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-subtle",
                    "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                    active && "bg-brand-subtle"
                  )}
                >
                  {/* Overlapping light/dark/accent swatches (old look). */}
                  <span className="flex flex-shrink-0 items-center">
                    <span
                      className="h-4 w-4 rounded-full border-2 border-surface ring-1 ring-line"
                      style={{ backgroundColor: p.swatches.light }}
                      title="Light variant"
                    />
                    <span
                      className="-ml-2 h-4 w-4 rounded-full border-2 border-surface ring-1 ring-line"
                      style={{ backgroundColor: p.swatches.dark }}
                      title="Dark variant"
                    />
                    <span
                      className="-ml-2 h-4 w-4 rounded-full border-2 border-surface ring-1 ring-line"
                      style={{ backgroundColor: p.swatches.accent }}
                      title="Accent"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-fg">{p.label}</span>
                    <span className="block truncate text-[10px] text-fg-muted">{p.desc}</span>
                  </span>
                  {active && (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
