"use client";

import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Server, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";
import { SystemEnvCard, CacheStatsCard } from "./admin-extras";

/**
 * modules/platform-portal — P3 System health (V1 SystemPanel re-homed,
 * W10 audit). Live db/ai/jwt checks + cron schedule + cache purge.
 */

interface SystemData {
  health: string;
  checks: { db: boolean; ai: boolean; jwt: boolean };
  env?: Record<string, string | boolean | null>;
  crons: Array<{ path: string; schedule: string; label: string }>;
}

export function PlatformSystem() {
  const { data, error, isLoading, retry } = useApi<SystemData>("/api/v2/platform/system");

  async function purgeCache() {
    try {
      await api.post("/api/v2/platform/system", { action: "purge-cache" });
      toast.success("Cache purged", { description: "In-memory caches were cleared." });
    } catch (e) {
      toast.error("Couldn't purge cache", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    }
  }

  if (isLoading) return <SysSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load system status</p>
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

  const checks = [
    { key: "db" as const, label: "Database" },
    { key: "ai" as const, label: "AI provider" },
    { key: "jwt" as const, label: "JWT auth" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">System</h1>

      {/* health checks */}
      <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Server className="h-4 w-4 text-fg-muted" aria-hidden />
          Health checks
          <span
            className={
              data.health === "ok"
                ? "rounded-md bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-on"
                : "rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-on"
            }
          >
            {data.health}
          </span>
        </h2>
        <div className="divide-y divide-line">
          {checks.map((c) => (
            <div key={c.key} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <span className="text-sm text-fg">{c.label}</span>
              {data.checks[c.key] ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-on">
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                  OK
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-on">
                  <XCircle className="h-4 w-4 text-danger" aria-hidden />
                  Down
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* crons */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Cron jobs</h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.crons.map((c) => (
            <div key={c.path} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{c.label}</p>
                <p className="truncate font-mono text-xs text-fg-muted">{c.path}</p>
              </div>
              <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-0.5 font-mono text-xs text-fg-secondary">
                {c.schedule}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* cache */}
      <section className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className="text-sm font-semibold text-fg">Cache</p>
          <p className="text-xs text-fg-muted">In-memory rate-limit and flag caches.</p>
        </div>
        <button
          type="button"
          onClick={purgeCache}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-bg-subtle px-3 text-sm font-medium text-fg hover:border-line-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Purge
        </button>
      </section>

      {/* W16: V1 SystemPanel env status + maintenance cache stats */}
      {data.env && <SystemEnvCard env={data.env} />}
      <CacheStatsCard />
    </div>
  );
}

function SysSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-32 rounded-md bg-bg-subtle" />
      <div className="h-48 rounded-xl bg-bg-subtle" />
      <div className="h-40 rounded-xl bg-bg-subtle" />
    </div>
  );
}
