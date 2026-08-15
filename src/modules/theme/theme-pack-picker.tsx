"use client";

import { BedDouble, LayoutPanelLeft, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeV2, type ThemeModeV2 } from "./theme-provider-v2";

/**
 * modules/theme — ThemePackPicker (W15, user request: theme pack in Settings)
 *
 * The full theme pack gallery: every mode the global theme engine
 * ships (Light / Dark / Bed / Classic) as a selectable card with a
 * live-ish miniature preview. Mounted in Settings surfaces (learner
 * Profile → Appearance, org Control) — the segmented ModeToggle in the
 * portal shells stays for quick switching.
 *
 * Preview swatches are static approximations of each pack (the real
 * tokens resolve per html[data-mode] at document scope, which a card
 * cannot reproduce) — documented in each pack's meta line.
 */

interface PackDef {
  mode: ThemeModeV2;
  label: string;
  tagline: string;
  icon: typeof Sun;
  swatches: { canvas: string; card: string; brand: string; text: string };
}

const PACKS: PackDef[] = [
  {
    mode: "light",
    label: "Light",
    tagline: "The default v2 canvas — neutral-cool surfaces",
    icon: Sun,
    swatches: { canvas: "#F7F7F8", card: "#FFFFFF", brand: "#B45309", text: "#3F3F46" },
  },
  {
    mode: "dark",
    label: "Dark",
    tagline: "Elevated dark surfaces, reduced saturation",
    icon: Moon,
    swatches: { canvas: "#23232E", card: "#2E2E3A", brand: "#E8B45A", text: "#EAEAEF" },
  },
  {
    mode: "bed",
    label: "Bed",
    tagline: "Warm dimmed night mode for late study",
    icon: BedDouble,
    swatches: { canvas: "#201B14", card: "#2A241C", brand: "#D9A34A", text: "#E8DFD2" },
  },
  {
    mode: "classic",
    label: "Classic",
    tagline: "Star Admin vertical — indigo, light sidebar",
    icon: LayoutPanelLeft,
    swatches: { canvas: "#F4F5F7", card: "#FFFFFF", brand: "#1F3BB3", text: "#1F1F1F" },
  },
];

export function ThemePackPicker({ className }: { className?: string }) {
  const { mode, setMode, mounted } = useThemeV2();

  if (!mounted) {
    return (
      <div aria-hidden className={cn("grid animate-pulse grid-cols-2 gap-2 lg:grid-cols-4", className)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-bg-subtle" />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme pack"
      className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4", className)}
    >
      {PACKS.map((p) => {
        const active = mode === p.mode;
        const Icon = p.icon;
        return (
          <button
            key={p.mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(p.mode)}
            className={cn(
              "group rounded-xl border p-2.5 text-left transition-colors",
              "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              active
                ? "border-brand bg-surface shadow-elev-1"
                : "border-line bg-surface hover:border-line-strong"
            )}
          >
            {/* miniature preview */}
            <span
              aria-hidden
              className="flex h-16 w-full overflow-hidden rounded-lg border border-line"
              style={{ background: p.swatches.canvas }}
            >
              <span
                className="w-1/3 border-r border-black/10"
                style={{ background: p.swatches.canvas }}
              >
                <span className="mt-1.5 flex items-center gap-1 px-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: p.swatches.brand }} />
                  <span className="h-1.5 w-6 rounded-sm" style={{ background: p.swatches.text, opacity: 0.7 }} />
                </span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="mt-1.5 flex items-center gap-1 px-1.5"
                    style={{ opacity: i === 0 ? 1 : 0.55 }}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-sm", i === 0 && "font-bold")}
                      style={{ background: i === 0 ? p.swatches.brand : p.swatches.text }}
                    />
                    <span className="h-1.5 w-8 rounded-sm" style={{ background: p.swatches.text, opacity: 0.5 }} />
                  </span>
                ))}
              </span>
              <span className="flex-1 p-1.5">
                <span className="block h-3 w-16 rounded-sm" style={{ background: p.swatches.text, opacity: 0.8 }} />
                <span className="mt-1.5 flex gap-1">
                  <span className="h-7 flex-1 rounded-sm border border-black/5" style={{ background: p.swatches.card }} />
                  <span className="h-7 flex-1 rounded-sm border border-black/5" style={{ background: p.swatches.card }} />
                </span>
                <span
                  className="mt-1.5 block h-5 w-14 rounded-sm"
                  style={{ background: p.swatches.brand }}
                />
              </span>
            </span>

            <span className="mt-2 flex items-center justify-between gap-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
                <span className={cn("truncate text-sm font-semibold", active ? "text-brand" : "text-fg")}>
                  {p.label}
                </span>
              </span>
              {active && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
              )}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">{p.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
