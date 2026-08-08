"use client";

import { Card, CardContent } from "@/components/ui/card";

export type StatCardAccent = "emerald" | "cyan" | "amber" | "violet" | "red";

export function StatCard({ label, value, sub, icon, accent = "emerald" }: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  accent?: StatCardAccent;
}) {
  // BUG FIX: the type union previously included "warning" but the accents
  // object keyed on "amber". Calling <StatCard accent="warning"> returned
  // undefined → broken CSS class → card rendered with no styling.
  // Fixed: type and keys now match. "warning" is accepted as an alias
  // for "amber" for backward compat with any existing callers.
  const accents: Record<StatCardAccent, string> = {
    emerald: "from-primary/15 to-primary/5 text-primary border-primary/30",
    cyan: "from-secondary/20 to-secondary/5 text-secondary-foreground border-secondary-foreground/30",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/30",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400 border-violet-500/30",
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <Card className={`bg-gradient-to-br ${accents[accent]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/80">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</div>
        {sub && <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

