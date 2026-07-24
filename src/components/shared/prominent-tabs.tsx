"use client";

import { cn } from "@/lib/utils";

/**
 * ProminentTabs — a reusable, theme-synced horizontal tab bar.
 *
 * Features:
 * - Prominent active state (primary background, primary-foreground text)
 * - Icon support (each tab can have an icon)
 * - Badge support (e.g. alert counts)
 * - Horizontally scrollable on mobile (no scrollbar visible)
 * - Theme-synced (uses primary/accent/muted CSS variables)
 * - Two variants:
 *   - "pill" — rounded pill buttons (default, for top-level nav)
 *   - "underline" — bottom-border underline (for sub-tabs in detail pages)
 *
 * Usage:
 *   <ProminentTabs
 *     tabs={[
 *       { key: "today", label: "Today", icon: Calendar, badge: 7 },
 *       { key: "students", label: "Students", icon: Users },
 *     ]}
 *     active="today"
 *     onChange={(key) => setTab(key)}
 *   />
 */

export interface ProminentTab {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: "amber" | "red" | "blue" | "green";
}

interface ProminentTabsProps {
  tabs: ProminentTab[];
  active: string;
  onChange: (key: string) => void;
  variant?: "pill" | "underline";
  className?: string;
  size?: "sm" | "md" | "lg";
}

const BADGE_COLORS = {
  amber: "bg-amber-500 text-white",
  red: "bg-rose-500 text-white",
  blue: "bg-blue-500 text-white",
  green: "bg-emerald-500 text-white",
};

const SIZE_CLASSES = {
  sm: { button: "px-2.5 py-1 text-xs gap-1", icon: "h-3.5 w-3.5", badge: "min-w-[1.1rem] h-4 text-[9px]" },
  md: { button: "px-3 py-1.5 text-xs gap-1.5", icon: "h-3.5 w-3.5", badge: "min-w-[1.25rem] h-5 text-[10px]" },
  lg: { button: "px-4 py-2 text-sm gap-2", icon: "h-4 w-4", badge: "min-w-[1.4rem] h-5 text-[10px]" },
};

export function ProminentTabs({
  tabs,
  active,
  onChange,
  variant = "pill",
  className,
  size = "md",
}: ProminentTabsProps) {
  const sizes = SIZE_CLASSES[size];

  if (variant === "underline") {
    return (
      <div
        className={cn(
          "flex gap-0 border-b border-border overflow-x-auto",
          className
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex items-center font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0",
                sizes.button,
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {Icon && <Icon className={cn(sizes.icon, "flex-shrink-0")} />}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center font-bold rounded-full",
                    sizes.badge,
                    BADGE_COLORS[tab.badgeColor || "amber"]
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // pill variant (default)
  return (
    <div
      className={cn(
        "flex gap-1 flex-wrap p-1 bg-muted/50 rounded-xl border border-border/50",
        className
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center font-medium rounded-lg transition-all",
              sizes.button,
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {Icon && <Icon className={cn(sizes.icon, "flex-shrink-0")} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  "ml-1 inline-flex items-center justify-center font-bold rounded-full",
                  sizes.badge,
                  isActive
                    ? "bg-white/20 text-white"
                    : BADGE_COLORS[tab.badgeColor || "amber"]
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
