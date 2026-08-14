"use client";

import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — I10 Earnings (REDESIGN-P3 §I10, W6)
 *
 * Marketplace instructors only (the endpoint returns empty for
 * instructors with no completed payments). KPIs + monthly trend bars
 * + top courses + recent sales, via the kept v1 /api/instructor/
 * earnings endpoint.
 */

interface EarningsData {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  monthlyData: Array<{ month: string; earnings: number; sales: number }>;
  topCourses: Array<{ courseId: string; courseName: string; sales: number; earnings: number }>;
  recentSales: Array<{ studentName: string; courseName: string; amount: number; currency: string; date: string }>;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function InstructorEarnings() {
  const { data, error, isLoading, retry } = useApi<EarningsData>(
    "/api/v2/instructor/earnings",
  );

  if (isLoading) return <EarningsSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load earnings</p>
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

  const maxMonth = Math.max(0, ...data.monthlyData.map((m) => m.earnings));
  const hasSales = data.totalEarnings > 0 || data.recentSales.length > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Earnings</h1>

      {!hasSales ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <Wallet className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No earnings yet</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Sales from your marketplace courses will appear here once learners enrol.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
              <p className="text-xs font-medium text-fg-muted">Net earnings</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-fg md:text-2xl">
                {fmt(data.netEarnings)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
              <p className="text-xs font-medium text-fg-muted">Gross</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-fg md:text-2xl">
                {fmt(data.totalEarnings)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
              <p className="text-xs font-medium text-fg-muted">Platform fees</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-fg md:text-2xl">
                {fmt(data.platformFees)}
              </p>
            </div>
          </div>

          {/* monthly bars */}
          {data.monthlyData.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                Monthly
              </h2>
              <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
                {data.monthlyData.slice(0, 6).map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs tabular-nums text-fg-muted">{m.month}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${maxMonth > 0 ? (m.earnings / maxMonth) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-fg-secondary">
                      {fmt(m.earnings)} ({m.sales})
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* top courses + recent sales */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {data.topCourses.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Top courses
                </h2>
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {data.topCourses.map((c) => (
                    <div key={c.courseId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{c.courseName}</p>
                      <span className="shrink-0 text-xs tabular-nums text-fg-muted">{c.sales} sales</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">
                        {fmt(c.earnings)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.recentSales.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Recent sales
                </h2>
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {data.recentSales.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{s.courseName}</p>
                        <p className="truncate text-xs text-fg-muted">
                          {s.studentName} · {new Date(s.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">
                        {fmt(s.amount)} {s.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EarningsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-32 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
