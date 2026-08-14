"use client";

import { AlertTriangle, RefreshCw, Sparkles, Users, Zap } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O7 Study Analytics (REDESIGN-P3 §O7, W7)
 *
 * Org engagement aggregate: KPIs (events, active learners, exam
 * sessions) + a 14-day activity strip + the top event types. Data is
 * scoped to the org's members (EngagementEvent rows).
 */

interface AnalyticsData {
  kpis: { events: number; activeLearners: number; sessions: number };
  daily: Array<{ date: string; count: number }>;
  byType: Array<{ eventType: string; count: number }>;
}

export function OrgAnalytics() {
  const { data, error, isLoading, retry } = useApi<AnalyticsData>("/api/v2/org/analytics");

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

  const maxDay = Math.max(0, ...data.daily.map((d) => d.count));

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Study analytics</h1>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Kpi label="Events" value={data.kpis.events} icon={Zap} tone="brand" />
        <Kpi label="Active learners" value={data.kpis.activeLearners} icon={Users} tone="info" />
        <Kpi label="Exam sessions" value={data.kpis.sessions} icon={Sparkles} tone="muted" />
      </div>

      {/* 14-day activity strip */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Activity · last 14 days
        </h2>
        {data.daily.every((d) => d.count === 0) ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No engagement events yet — activity appears as learners use the platform.
          </p>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex h-24 items-end gap-1.5" role="img" aria-label="Daily activity for the last 14 days">
              {data.daily.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count} events`}
                  className="min-w-0 flex-1 rounded-t-sm bg-brand/70"
                  style={{ height: `${maxDay > 0 ? Math.max(6, (d.count / maxDay) * 100) : 6}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-fg-muted">
              <span>{data.daily[0]?.date.slice(5) ?? ""}</span>
              <span>{data.daily[data.daily.length - 1]?.date.slice(5) ?? ""}</span>
            </div>
          </div>
        )}
      </section>

      {/* event mix */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Top event types
        </h2>
        {data.byType.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No events yet.
          </p>
        ) : (
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
            {data.byType.map((t) => (
              <div key={t.eventType} className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-xs text-fg">{t.eventType}</p>
                <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-fg-secondary">
                  {t.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Zap;
  tone: "brand" | "info" | "muted";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    info: "bg-info-subtle text-info-on",
    muted: "bg-bg-subtle text-fg-muted",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-bg-subtle" />
    </div>
  );
}
