"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

/** ThemePreferenceControl — 3-button theme switcher (light/dark/system).
 *
 *  Phase 5.1: Extracted from StudentDashboard.tsx. Used in the SettingsPanel.
 *  Uses next-themes directly (same as the sidebar toggle).
 */
export function ThemePreferenceControl() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 bg-muted rounded animate-pulse" />;
  }

  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            aria-label={`Set theme to ${opt.label}`}
            aria-pressed={active}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
