"use client";

// src/modules/learn/components/classroom/ActivityRail.tsx — the classroom
// activity rail: top horizontal bar on mobile, left icon rail on desktop.
// One entry per panel — the topic map (Journey) lives here and ONLY here
// (classroom audit A1: it used to exist twice, with different UIs).

import { Map as MapIcon, Target, TrendingUp, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelKey } from "./panel-keys";

/**
 * The classroom's four panels. Kept as a tiny shared module so the rail,
 * the drawer and the deep-link (?panel=journey) can never drift apart.
 */
export const PANELS: { key: PanelKey; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { key: "journey", icon: MapIcon, label: "Journey" },
  { key: "project", icon: Target, label: "Project" },
  { key: "grow", icon: TrendingUp, label: "Grow" },
  { key: "library", icon: BookOpen, label: "Library" },
];

export function panelLabel(key: PanelKey): string {
  const found = PANELS.find((p) => p.key === key);
  return found ? found.label : key;
}

export function ActivityRail({
  activePanel,
  onSelect,
}: {
  activePanel: PanelKey | null;
  onSelect: (key: PanelKey) => void;
}) {
  return (
    <nav
      className="flex w-full flex-shrink-0 items-center justify-start gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-[72px] lg:flex-col lg:items-center lg:gap-1.5 lg:overflow-visible lg:border-b-0 lg:border-r lg:px-0 lg:py-3"
      aria-label="Classroom panels"
    >
      {PANELS.map(({ key, icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          title={label}
          aria-pressed={activePanel === key}
          className={cn(
            "flex h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-md px-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus lg:h-14 lg:w-14 lg:flex-col lg:px-0",
            activePanel === key
              ? "bg-brand-subtle text-brand"
              : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
          )}
        >
          {(() => {
            const Icon = icon;
            return <Icon className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />;
          })()}
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
      <div className="hidden flex-1 lg:block" />
    </nav>
  );
}
