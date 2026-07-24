"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useThemePreset } from "./theme-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified theme toggle — combines:
 *   1. Light / Dark / System mode (via next-themes)
 *   2. Theme preset picker (Modern Slate, Ocean Blue, Forest Sage, Sunset Rose)
 *
 * Renders as a single button with a dropdown menu.
 */
export function UnifiedThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { preset, presets, setPresetId, presetId } = useThemePreset();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Palette className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Palette className="h-4 w-4" />
          <span
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-background"
            style={{ backgroundColor: preset.accentColor }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Appearance
        </DropdownMenuLabel>

        {/* Mode (light/dark/system) */}
        <div className="px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Mode</div>
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-3.5 w-3.5 mr-1" /> Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-3.5 w-3.5 mr-1" /> Dark
            </Button>
            <Button
              size="sm"
              variant={theme === "system" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setTheme("system")}
            >
              <Monitor className="h-3.5 w-3.5 mr-1" /> Auto
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Preset themes */}
        <div className="px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Theme</div>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left",
                presetId === p.id && "bg-accent"
              )}
            >
              <div className="flex gap-1 flex-shrink-0">
                <span
                  className="w-4 h-4 rounded-full border-2 border-background ring-1 ring-border"
                  style={{ backgroundColor: p.light.primary }}
                  title="Light mode primary"
                />
                <span
                  className="w-4 h-4 rounded-full border-2 border-background ring-1 ring-border -ml-2"
                  style={{ backgroundColor: p.dark.primary }}
                  title="Dark mode primary"
                />
                <span
                  className="w-4 h-4 rounded-full border-2 border-background ring-1 ring-border -ml-2"
                  style={{ backgroundColor: p.accentColor }}
                  title="Accent"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.description}</div>
              </div>
              {presetId === p.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
