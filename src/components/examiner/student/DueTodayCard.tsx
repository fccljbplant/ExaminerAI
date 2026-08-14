"use client";
// src/components/examiner/student/DueTodayCard.tsx
// Replaces the DailyTaskReminder modal popup. Due items live inline on
// the Today screen; the learner acts with one tap instead of dismissing
// a dialog. Popups are now reserved for red-tier alerts only.
import { useEffect, useState } from "react";
import { SkeletonPanel } from "@/modules/ui/states";

export type DueItemKind = "daily-test" | "drill" | "project-task" | "weekly-test" | "checkin";

export interface DueItem {
  kind: DueItemKind;
  title: string;
  meta: string;
  /** Direct route href — use this when the target is a real Next.js route. */
  href?: string;
  /** Internal view key — use this when the target is an in-app view state. */
  view?: string;
  urgent?: boolean;
}

interface TodaySummary {
  due?: DueItem[];
}

interface DueTodayCardProps {
  /** Called when an item with a `view` is tapped. The dashboard maps view → setView. */
  onNavigate?: (view: string, kind: DueItemKind) => void;
  /** Optional override of items (skip the fetch). Useful for tests/storybook. */
  items?: DueItem[];
}

export default function DueTodayCard({ onNavigate, items }: DueTodayCardProps) {
  // When `items` is passed in, skip the fetch entirely — derive directly.
  const [fetched, setFetched] = useState<TodaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items) return; // caller provided items; no fetch needed
    const ctrl = new AbortController();
    fetch("/api/today/summary", { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TodaySummary) => setFetched(json))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => ctrl.abort();
  }, [items]);

  // Derive the effective items list from either prop or fetched data.
  const effectiveItems = items ?? fetched?.due ?? null;

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <p className="text-sm font-bold text-destructive">Couldn&apos;t load today&apos;s tasks</p>
        <p className="mt-1 text-xs text-destructive/70">{error}</p>
      </div>
    );
  }

  // Loading state only applies when we're fetching (no items prop, no fetched data yet).
  if (!items && effectiveItems === null) {
    return <SkeletonPanel lines={3} className="h-24" />;
  }

  const list = effectiveItems ?? [];

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm font-bold text-foreground">All clear for today 🎉</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Come back tomorrow — your streak is safe.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Due today
      </p>
      <ul className="mt-3 space-y-2">
        {list.map((item, idx) => {
          const handleNavigate = () => {
            if (item.view && onNavigate) {
              onNavigate(item.view, item.kind);
            }
          };

          // Anchor mode (real route) — lets the browser handle the navigation.
          if (item.href && !onNavigate) {
            return (
              <li key={`${item.kind}-${idx}`}>
                <a
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {item.urgent && (
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-400 align-middle" />
                      )}
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.meta}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-primary">Do →</span>
                </a>
              </li>
            );
          }

          // Button mode (in-app view switch).
          return (
            <li key={`${item.kind}-${idx}`}>
              <button
                type="button"
                onClick={handleNavigate}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">
                    {item.urgent && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-400 align-middle" />
                    )}
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-primary">Do →</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
