"use client";
// src/components/shared/learner-xp-bar.tsx
// Casual-yet-professional XP bar for learners. Shown only on the
// learner dashboard (not mentors, not admins).
//
// Voice: "You're at Level 3 · Building confidence. 40 XP to next level."
// Not: "Beginner · 320 XP · 64% to Level 4" (that's LMS-speak).
//
// Mount this once on the learner's TodayView.

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Sparkles, TrendingUp } from "lucide-react";
import type { Level } from "../lib/learner-xp";

interface LearnerXPData {
  total: number;
  level: Level;
  progress: { current: number; needed: number; pct: number; toNext: number };
  recentAwards: Array<{ reason: string; amount: number; at: string }>;
}

const REASON_LABELS: Record<string, string> = {
  DAILY_TEST_PASSED: "Daily test passed",
  DAILY_TEST_ACED: "Daily test aced",
  WEEKLY_TEST_PASSED: "Weekly test passed",
  WEEKLY_TEST_ACED: "Weekly test aced",
  DRILL_MASTERED: "Drill mastered",
  PROJECT_WEEK_COMPLETED: "Project week done",
  PROJECT_MILESTONE_SIGNED: "Milestone signed off",
};

export function LearnerXPBar({ className = "" }: { className?: string }) {
  const [data, setData] = useState<LearnerXPData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<LearnerXPData>("/api/learner/xp")
      .then((res) => setData(res))
      .catch(() => setData(null)) // silent — XP bar is non-critical
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-line bg-surface p-4 animate-pulse", className)}>
        <div className="h-3 w-32 rounded bg-bg-subtle" />
        <div className="mt-3 h-2 w-full rounded bg-bg-subtle" />
      </div>
    );
  }

  if (!data) return null; // silent failure — don't bother the learner

  const { level, progress, total } = data;

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle">
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">
              Level {level.level} · {level.label}
            </p>
            <p className="text-xs text-fg truncate">
              {total} XP{progress.toNext > 0 && (
                <span className="text-fg-muted"> · {progress.toNext} to next level</span>
              )}
            </p>
          </div>
        </div>
        {progress.toNext > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-fg-muted tabular-nums">{progress.pct}%</p>
          </div>
        )}
      </div>

      {/* Progress bar — subtle, not gamified-cheesy */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${progress.pct}%` }}
        />
      </div>

      {/* Recent awards — last 3, no timestamps (keeps it light) */}
      {data.recentAwards.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.recentAwards.slice(0, 3).map((award, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-bg-subtle/60 px-2 py-0.5 text-[10px] text-fg-muted"
            >
              <TrendingUp className="h-2.5 w-2.5" />
              +{award.amount} {REASON_LABELS[award.reason] || award.reason}
            </span>
          ))}
        </div>
      )}

      {/* The hint — casual, encouraging, not prescriptive */}
      <p className="mt-2 text-[11px] text-fg-muted italic">
        {level.hint}
      </p>
    </div>
  );
}
