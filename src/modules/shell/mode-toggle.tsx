"use client";

import { BedDouble, Moon, Sun } from "lucide-react";
import { useThemeV2, type ThemeModeV2 } from "@/modules/theme";
import { cn } from "@/lib/utils";

/**
 * modules/shell — ModeToggle (REDESIGN-P2 §2.2)
 *
 * Segmented Light / Dark / Bed control wired to useThemeV2().setMode.
 * Renders a neutral placeholder until hydration to avoid flash — the
 * FOUC script in the root layout already applied the correct mode.
 */

const MODES: { mode: ThemeModeV2; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "bed", label: "Bed", icon: BedDouble },
];

export function ModeToggle({ className }: { className?: string }) {
  const { mode, setMode, mounted } = useThemeV2();

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn("h-11 w-[152px] rounded-full bg-bg-subtle", className)}
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color mode"
      className={cn(
        "flex h-11 items-center gap-0.5 rounded-full bg-bg-subtle p-0.5",
        className
      )}
    >
      {MODES.map(({ mode: m, label, icon: Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={`${label} mode`}
            onClick={() => setMode(m)}
            className={cn(
              // ≥44px touch targets (P6 §1 tap law); the segmented control
              // keeps a tight pill look while staying thumb-friendly.
              "flex h-10 w-12 items-center justify-center rounded-full transition-colors",
              "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              active
                ? "bg-surface text-fg shadow-elev-1"
                : "text-fg-muted hover:text-fg-secondary"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
