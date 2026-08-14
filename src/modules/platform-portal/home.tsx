"use client";

import { AlertTriangle, Building2, RefreshCw, ScrollText, Users } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/platform-portal — P1 Home (REDESIGN-P3 §P1, W7)
 *
 * Platform KPIs (orgs, active members, users, audit actions) + the
 * orgs table (plan/seats/members) + the recent global audit feed.
 * One aggregate endpoint (GET /api/v2/platform/home).
 */

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  seatsUsed: number;
  members: number;
  createdAt: string;
}

interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  createdAt: string;
}

interface PlatformHomeData {
  kpis: { orgs: number; activeMembers: number; users: number; auditActions: number };
  orgs: OrgRow[];
  recentAudit: AuditRow[];
}

export function PlatformHome() {
  const { data, error, isLoading, retry } = useApi<PlatformHomeData>("/api/v2/platform/home");

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load platform data</p>
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

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Platform</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Organizations" value={data.kpis.orgs} icon={Building2} tone="brand" />
        <Kpi label="Active members" value={data.kpis.activeMembers} icon={Users} tone="info" />
        <Kpi label="Users" value={data.kpis.users} icon={Users} tone="muted" />
        <Kpi label="Audit actions" value={data.kpis.auditActions} icon={ScrollText} tone="warning" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        {/* orgs table */}
        <section className="space-y-2 lg:col-span-7">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Organizations
          </h2>
          {data.orgs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No organizations yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.orgs.map((o) => (
                <div key={o.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{o.name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {o.slug} · {o.plan} · {o.members} members
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-fg-secondary">
                    {o.seatsUsed}/{o.seats} seats
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* recent audit */}
        <section className="space-y-2 lg:col-span-5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Recent activity
          </h2>
          {data.recentAudit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No audited actions yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.recentAudit.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{a.action}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {a.actorName} ({a.actorRole}) · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
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
  icon: typeof Users;
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

function HomeSkeleton() {
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
