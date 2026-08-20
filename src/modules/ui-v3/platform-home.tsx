"use client";

// src/modules/ui-v3/platform-home.tsx — V3 platform admin dashboard CONTENT (no shell).
// Uses useApi() (auto-unwraps { ok, data } envelope). Loading/empty/error
// states use the shared State* components.

import { V3Card, V3StatCard, V3Badge, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

/** Shape mirrored from GET /api/v2/platform/home */
interface PlatformHomeData {
  orgCount?: number;
  userCount?: number;
  aiUsage?: number;
  healthy?: boolean;
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

  return (
    <>
      <V3PageHeader
        title="Platform Control Center"
        subtitle="Manage organizations, usage, AI services and platform health."
        action={<a href="/platform/settings" className="v3-btn v3-btn-primary">Platform settings</a>}
      />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Organizations" value={String(d.orgCount ?? 0)} label="All tenants" />
        <V3StatCard title="Active users" value={String(d.userCount ?? 0)} label="Across all tenants" />
        <V3StatCard title="AI requests" value={`${d.aiUsage ?? 0}%`} label="Of monthly capacity" />
        <V3StatCard title="System health" value={d.healthy ? "Healthy" : "Checking"} label="All services" />
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
