"use client";

import { AlertTriangle, Award, GraduationCap, RefreshCw, TrendingUp, UserRound, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * modules/platform-portal — B2C panel (W16: V1 B2CPanel restored)
 *
 * Independent learners (no org): totals, activity, certificates, avg
 * score and recent signups. Consumes the surviving /api/admin/b2c-stats.
 */

interface B2CData {
  totalLearners: number;
  activeToday: number;
  completedCertificates: number;
  avgScore: number | null;
  recentLearners: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    lastLogin: string | null;
    _count: { enrollments: number };
  }>;
}

export function PlatformB2C() {
  const [data, setData] = useState<B2CData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/b2c-stats");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as B2CData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void retry();
  }, [retry]);

  if (!data && !error) return <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />;
  if (error || !data) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
        {error}
        <button type="button" onClick={() => void retry()} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Independent learners</h1>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Total learners" value={data.totalLearners} icon={UserRound} tone="brand" />
        <Kpi label="Active today" value={data.activeToday} icon={Zap} tone="info" />
        <Kpi
          label="Certificates"
          value={data.completedCertificates}
          icon={Award}
          tone="muted"
        />
        <Kpi
          label="Avg score"
          value={data.avgScore != null ? `${data.avgScore}%` : "—"}
          icon={TrendingUp}
          tone={data.avgScore != null && data.avgScore < 60 ? "warning" : "muted"}
        />
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Recent signups
        </h2>
        {data.recentLearners.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No independent learners yet.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.recentLearners.map((l) => (
              <div key={l.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg">
                  {l.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("") || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{l.name}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {l.email} · joined {new Date(l.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-fg-secondary">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                  {l._count.enrollments}
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
  value: number | string;
  icon: typeof UserRound;
  tone: "brand" | "info" | "warning" | "muted";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    info: "bg-info-subtle text-info-on",
    warning: "bg-warning-subtle text-warning-on",
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
