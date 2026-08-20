"use client";

// src/modules/ui-v3/platform-home.tsx — V3 platform admin dashboard CONTENT (no shell).
// Field paths aligned to the real /api/v2/platform/home response shape:
//   { kpis: {orgs,activeMembers,users,auditActions,mrr,pipelineMrr,
//            fees30d,payoutsPending,aiSpend30d},
//     orgs: [...], recentAudit: [...], overview: {...} }

import { V3Card, V3StatCard, V3Badge, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

interface PlatformKpis {
  orgs?: number;
  activeMembers?: number;
  users?: number;
  auditActions?: number;
  mrr?: number;
  pipelineMrr?: number;
  fees30d?: number;
  payoutsPending?: number;
  aiSpend30d?: number;
}

interface PlatformOrg {
  id?: string;
  name?: string;
  slug?: string;
  plan?: string;
  seats?: number;
  seatsUsed?: number;
  members?: number;
  createdAt?: string;
}

interface PlatformAuditEntry {
  id?: string;
  actorName?: string;
  actorRole?: string;
  action?: string;
  targetType?: string;
  createdAt?: string;
}

interface PlatformHomeData {
  kpis?: PlatformKpis;
  orgs?: PlatformOrg[];
  recentAudit?: PlatformAuditEntry[];
  overview?: Record<string, unknown>;
}

function formatCurrency(value?: number): string {
  if (value == null) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value}`;
}

function timeAgo(value?: string): string {
  if (!value) return "—";
  try {
    const diff = Date.now() - new Date(value).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return "—";
  }
}

export function V3PlatformHomeContent() {
  const { data, loading, error, retry } = useApi<PlatformHomeData>("/api/v2/platform/home");

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={4} />
      </>
    );
  }
  if (error) return <StateError message={error} onRetry={retry} />;

  const d = data ?? {};
  const k = d.kpis ?? {};

  return (
    <>
      <V3PageHeader
        title="Platform Control Center"
        subtitle="Manage organizations, usage, AI services and platform health."
        action={<a href="/platform/settings" className="v3-btn v3-btn-primary">Platform settings</a>}
      />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Organizations" value={String(k.orgs ?? 0)} label="All tenants" />
        <V3StatCard title="Active members" value={String(k.activeMembers ?? 0)} label="Across all tenants" />
        <V3StatCard title="Total users" value={String(k.users ?? 0)} label="Signed-up accounts" />
        <V3StatCard title="MRR" value={formatCurrency(k.mrr)} label="Monthly recurring revenue" />
      </div>

      <V3SectionTitle title="Revenue" />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Pipeline MRR" value={formatCurrency(k.pipelineMrr)} label="In negotiation" />
        <V3StatCard title="Platform fees (30d)" value={formatCurrency(k.fees30d)} label="Last 30 days" />
        <V3StatCard title="Payouts pending" value={formatCurrency(k.payoutsPending)} label="Awaiting disbursement" />
        <V3StatCard title="AI spend (30d)" value={formatCurrency(k.aiSpend30d)} label="Provider costs" />
      </div>

      <V3SectionTitle title="Platform services" />

      <div className="v3-grid v3-grid-3">
        <V3Card>
          <V3Badge variant="success">● Operational</V3Badge>
          <h3 style={{ marginTop: 16 }}>Learning API</h3>
          <p>Course, lesson and progress services.</p>
        </V3Card>
        <V3Card>
          <V3Badge variant="success">● Operational</V3Badge>
          <h3 style={{ marginTop: 16 }}>AI Services</h3>
          <p>Tutor, generation and analytics models.</p>
        </V3Card>
        <V3Card>
          <V3Badge variant="success">● Operational</V3Badge>
          <h3 style={{ marginTop: 16 }}>Classroom Services</h3>
          <p>Live sessions and learner interactions.</p>
        </V3Card>
      </div>

      <V3SectionTitle title="Organizations" linkHref="/platform/orgs" linkLabel="View all →" />

      <V3Card className="v3-table-card">
        <table>
          <thead>
            <tr><th>Organization</th><th>Plan</th><th>Members</th><th>Seats</th><th>Created</th></tr>
          </thead>
          <tbody>
            {(d.orgs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No organizations provisioned yet.
                </td>
              </tr>
            ) : (
              (d.orgs ?? []).slice(0, 8).map((o, i) => (
                <tr key={o.id ?? i}>
                  <td><strong>{o.name ?? "Unnamed"}</strong></td>
                  <td><span className="v3-badge v3-badge-primary">{o.plan ?? "—"}</span></td>
                  <td>{o.members ?? 0}</td>
                  <td>{o.seatsUsed ?? 0} / {o.seats ?? 0}</td>
                  <td>{timeAgo(o.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </V3Card>

      <V3SectionTitle title="Recent audit activity" linkHref="/platform/audit" linkLabel="View audit log →" />

      <V3Card>
        {(d.recentAudit ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            No recent audit activity.
          </p>
        ) : (
          (d.recentAudit ?? []).map((a, i) => (
            <div key={a.id ?? i} className="v3-attention-item">
              <div>
                <strong>{a.action ?? "Unknown action"}</strong>
                <p>{a.actorName ?? "Unknown"} · {a.targetType ?? "—"}</p>
              </div>
              <small style={{ color: "var(--text-muted)", fontSize: "var(--p-type-xs)" }}>
                {timeAgo(a.createdAt)}
              </small>
            </div>
          ))
        )}
      </V3Card>

      <V3SectionTitle title="Quick management" />

      <div className="v3-grid v3-grid-3">
        <a href="/platform/orgs" className="v3-card" style={{ textAlign: "left", textDecoration: "none", color: "inherit" }}>
          <h3>Organizations →</h3>
          <p>Manage tenants and subscriptions</p>
        </a>
        <a href="/platform/ai" className="v3-card" style={{ textAlign: "left", textDecoration: "none", color: "inherit" }}>
          <h3>AI Configuration →</h3>
          <p>Models, limits and usage</p>
        </a>
        <a href="/platform/features" className="v3-card" style={{ textAlign: "left", textDecoration: "none", color: "inherit" }}>
          <h3>Feature Flags →</h3>
          <p>Control platform rollouts</p>
        </a>
      </div>
    </>
  );
}
