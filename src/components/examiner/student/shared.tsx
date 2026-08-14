"use client";

import { Card, CardContent } from "@/modules/ui/card";

/** StatSquareCard — small stat card used on the student dashboard overview.
 *
 *  Phase 5.1: Extracted from StudentDashboard.tsx.
 */
export type StatSquareAccent = "emerald" | "cyan" | "amber" | "rose" | "violet";

export function StatSquareCard({ label, value, icon, accent = "emerald" }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: StatSquareAccent;
}) {
  // BUG FIX: type union previously had "warning" but the accents object
  // keyed on "amber". Calling <StatSquareCard accent="warning"> returned
  // undefined → broken CSS. Fixed: type and keys now match.
  const accents: Record<StatSquareAccent, string> = {
    emerald: "from-primary/15 to-primary/5 border-primary/30",
    cyan: "from-secondary/20 to-secondary/5 border-secondary-foreground/30",
    amber: "from-amber-500/15 to-amber-500/5 border-growth-amber",
    rose: "from-destructive/15 to-destructive/5 border-destructive/30",
    violet: "from-violet-500/15 to-violet-500/5 border-violet-500/30",
  };
  const iconColors: Record<StatSquareAccent, string> = {
    emerald: "text-primary",
    cyan: "text-secondary-foreground",
    amber: "text-growth-amber",
    rose: "text-destructive",
    violet: "text-violet-500",
  };
  return (
    <Card className={`bg-gradient-to-br ${accents[accent]} border transition-transform duration-200 hover:scale-[1.05] hover:shadow-md`}>
      <CardContent className="p-2.5 flex flex-col items-center justify-center text-center">
        <span className={`mb-1 ${iconColors[accent]}`}>{icon}</span>
        <div className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      </CardContent>
    </Card>
  );
}

/** GanttChartIcon — inline SVG icon for the Project/Gantt tab.
 *  Phase 5.1: Extracted from StudentDashboard.tsx. */
export function GanttChartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="4" x2="21" y2="4" />
      <rect x="3" y="6" width="6" height="2.5" rx="0.5" />
      <rect x="3" y="10" width="10" height="2.5" rx="0.5" />
      <rect x="3" y="14" width="14" height="2.5" rx="0.5" />
      <rect x="3" y="18" width="18" height="2.5" rx="0.5" />
    </svg>
  );
}

/** GithubIcon — inline SVG icon for GitHub links.
 *  Phase 5.1: Extracted from StudentDashboard.tsx. */
export function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.82 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/** safeParse — safely parse a JSON string into a string array.
 *  Phase 5.1: Extracted from StudentDashboard.tsx. */
export function safeParse(s: string): string[] {
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Redirect the browser to a given view by setting ?view= param. */
export function redirectToView(view: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.location.href = url.toString();
}
