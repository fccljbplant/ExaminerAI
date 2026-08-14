"use client";

import { AlertTriangle, RefreshCw, TrendingUp, UserRound } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — I8 Analytics (REDESIGN-P3 §I8, W6)
 *
 * Cohort snapshot for the instructor's course via the kept v1
 * /api/instructor/cohort-analytics endpoint: KPI row + weekly
 * progress bars + topic difficulty chips + at-risk list.
 * (Distribution charts + item analysis land with the analytics
 * workstream.)
 */

interface AnalyticsData {
  totalStudents: number;
  activeThisWeek: number;
  avgScore: number;
  avgScoreTrend: string;
  completionRate: number;
  studentsNeedingAttention: number;
  topicDifficulty: Array<{ topic: string; level: string }>;
  weeklyProgress: Array<{ week: number; done: number; total: number }>;
  topPerformers: Array<{ name: string; score: number }>;
  studentsAtRisk: Array<{ name: string; reason: string }>;
}

export function InstructorAnalytics() {
  const { data, error, isLoading, retry } = useApi<AnalyticsData>(
    "/api/v2/instructor/analytics",
  );

  if (isLoading) return <AnalyticsSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load analytics</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  const trendUp = data.avgScoreTrend === "rising" || data.avgScoreTrend === "steady";

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Analytics</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Students" value={data.totalStudents} />
        <Stat label="Active this week" value={data.activeThisWeek} />
        <Stat
          label="Average score"
          value={`${Math.round(data.avgScore)}%`}
          hint={data.avgScoreTrend}
          tone={trendUp ? "success" : "warning"}
        />
        <Stat label="Completion" value={`${Math.round(data.completionRate)}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        {/* weekly progress */}
        <section className="space-y-2 lg:col-span-7">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Weekly progress
          </h2>
          {data.weeklyProgress.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No weekly progress data yet.
            </p>
          ) : (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              {data.weeklyProgress.map((w) => {
                const pct = w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;
                return (
                  <div key={w.week} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs tabular-nums text-fg-muted">
                      Week {w.week}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-secondary">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* topic difficulty */}
        <section className="space-y-2 lg:col-span-5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Topic difficulty
          </h2>
          {data.topicDifficulty.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              Not enough data yet.
            </p>
          ) : (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              {data.topicDifficulty.map((t) => (
                <div key={t.topic} className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm text-fg">{t.topic}</p>
                  <span
                    className={
                      t.level === "hard"
                        ? "shrink-0 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-on"
                        : "shrink-0 rounded-md bg-bg-subtle px-2 py-0.5 text-xs font-medium text-fg-muted"
                    }
                  >
                    {t.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* at-risk + top performers */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            At risk
          </h2>
          {data.studentsAtRisk.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No students at risk.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.studentsAtRisk.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <UserRound className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                    <p className="truncate text-xs text-fg-muted">{s.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Top performers
          </h2>
          {data.topPerformers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No completions yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.topPerformers.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{s.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-success-on">
                    <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
                    {Math.round(s.score)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "success" | "warning" | "muted";
}) {
  const tones = {
    success: "text-success-on",
    warning: "text-warning-on",
    muted: "text-fg-muted",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className={`text-[11px] ${tones[tone]}`}>{hint}</p>}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-32 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-bg-subtle" />
    </div>
  );
}
