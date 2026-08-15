"use client";

import { AlertTriangle, Cpu, RefreshCw, Zap } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";
import { AILimitsCard, AIConnectionCard } from "./admin-extras";

/**
 * modules/platform-portal — P4 AI usage (V1 AILimitsPanel re-homed,
 * W10 audit). Usage aggregates from AIUsageLog: totals, by provider,
 * by feature, recent calls.
 */

interface AIData {
  totals: { requests: number; tokens: number };
  byProvider: Array<{ provider: string; requests: number; tokens: number; promptTokens: number; completionTokens: number }>;
  byFeature: Array<{ feature: string; requests: number; tokens: number }>;
  recent: Array<{ id: string; provider: string; model: string; feature: string; tokens: number; at: string }>;
}

export function PlatformAI() {
  const { data, error, isLoading, retry } = useApi<AIData>("/api/v2/platform/ai");

  if (isLoading) return <AISkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load AI usage</p>
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

  const maxProvider = Math.max(0, ...data.byProvider.map((p) => p.tokens));

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">AI usage</h1>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Requests" value={data.totals.requests} icon={Zap} tone="brand" />
        <Kpi label="Tokens" value={data.totals.tokens.toLocaleString()} icon={Cpu} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <AILimitsCard />
        <AIConnectionCard />
      </div>

      {data.byProvider.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            By provider
          </h2>
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
            {data.byProvider.map((p) => (
              <div key={p.provider} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-fg-muted">{p.provider}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${maxProvider > 0 ? (p.tokens / maxProvider) * 100 : 0}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-fg-secondary">
                  {p.tokens.toLocaleString()} · {p.requests}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.byFeature.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            By feature
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.byFeature.map((f) => (
              <div key={f.feature} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{f.feature}</p>
                <span className="shrink-0 text-xs tabular-nums text-fg-secondary">
                  {f.tokens.toLocaleString()} tok · {f.requests}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Recent calls
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.recent.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{r.feature}</p>
                <span className="shrink-0 text-xs text-fg-muted">{r.provider} · {r.model}</span>
                <span className="shrink-0 text-xs tabular-nums text-fg-secondary">{r.tokens} tok</span>
              </div>
            ))}
          </div>
        </section>
      )}
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
  icon: typeof Zap;
  tone: "brand" | "info";
}) {
  const tones = { brand: "bg-brand-subtle text-fg", info: "bg-info-subtle text-info-on" } as const;
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

function AISkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-32 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
