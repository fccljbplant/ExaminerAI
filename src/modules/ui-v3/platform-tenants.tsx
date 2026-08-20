"use client";

// src/modules/ui-v3/platform-tenants.tsx — V3 Platform Tenants (full restyle).
// Reimplements v2 PlatformTenants (platform-portal/tenants.tsx, 392 lines)
// with v3 design tokens. Same /api/v2/platform/orgs endpoints, same
// business logic (search, lifecycle actions, per-org feature flag overrides).
//
// Reuses v2 Switch (Radix-based toggle). All other UI uses v3 tokens.

import { useEffect, useState } from "react";
import { Ban, Building2, CheckCircle2, Clock, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Switch } from "@/modules/ui/switch";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateSkeleton, StateEmpty } from "./states";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  seatsUsed: number;
  members: number;
  status: string;
  trialEndsAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

interface TenantDetail extends TenantRow {
  description: string | null;
  website: string | null;
  subscription: {
    plan: string; seats: number; status: string; currentPeriodEnd: string | null;
  } | null;
  invoices: { id: string; amount: number; currency: string; status: string; createdAt: string }[];
  flagOverrides: { key: string; enabled: boolean }[];
}

const PORTAL_FLAGS = ["learner", "study_flow", "submissions", "exams", "instructor", "org", "platform"];

function statusBadgeVariant(status: string): { variant: "primary" | "success" | "warning" | undefined; label: string } {
  if (status === "trial") return { variant: "primary", label: "Trial" };
  if (status === "active") return { variant: "success", label: "Active" };
  if (status === "suspended") return { variant: "warning", label: "Suspended" };
  return { variant: undefined, label: status };
}

export function V3PlatformTenants() {
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { tenants: TenantRow[] } }>(
        `/api/v2/platform/orgs?search=${encodeURIComponent(search)}`,
      );
      setRows(res.data.tenants);
    } catch (e) {
      toast.error("Couldn't load tenants", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  async function openDetail(id: string) {
    setBusy(true);
    try {
      const res = await api.get<{ data: { tenant: TenantDetail } }>(`/api/v2/platform/orgs/${id}`);
      setDetail(res.data.tenant);
    } catch (e) {
      toast.error("Couldn't load tenant", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function createOrg() {
    const name = window.prompt("New organization name:");
    if (!name) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: { tenant: { id: string } } }>("/api/v2/platform/orgs", { name });
      toast.success("Organization created");
      void load();
      void openDetail(res.data.tenant.id);
    } catch (e) {
      toast.error("Create failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function patchTenant(id: string, patch: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await api.patch<{ data: { tenant: TenantDetail } }>(`/api/v2/platform/orgs/${id}`, patch);
      setDetail(res.data.tenant);
      toast.success(successMsg);
      void load();
    } catch (e) {
      toast.error("Update failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function setFlagOverride(orgId: string, key: string, enabled: boolean) {
    setBusy(true);
    try {
      const res = await api.put<{ data: { overrides: { key: string; enabled: boolean }[] } }>(
        `/api/v2/platform/orgs/${orgId}/flags`,
        { key, enabled },
      );
      setDetail((d) => (d ? { ...d, flagOverrides: res.data.overrides } : d));
    } catch (e) {
      toast.error("Override failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <V3PageHeader
        title="Organizations"
        subtitle="Tenant lifecycle, trials, seats, and per-org feature rollout."
        action={
          <form
            style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)", flexWrap: "wrap" }}
            onSubmit={(e) => { e.preventDefault(); void load(); }}
          >
            <div className="v3-search-wrap" style={{ minWidth: 220 }}>
              <span aria-hidden><Search size={14} /></span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or slug…"
                aria-label="Search organizations"
                className="v3-input search"
              />
            </div>
            <button type="submit" className="v3-btn v3-btn-primary">Search</button>
            <button type="button" onClick={() => void createOrg()} disabled={busy} className="v3-btn">
              + Create org
            </button>
          </form>
        }
      />

      {loading ? (
        <StateSkeleton cards={5} />
      ) : !rows || rows.length === 0 ? (
        <StateEmpty
          headline="No organizations yet"
          description="Orgs appear here after B2B signup. Use 'Create org' to provision a tenant manually."
        />
      ) : (
        <V3Card className="v3-table-card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Trial</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const badge = statusBadgeVariant(t.status);
                return (
                  <tr key={t.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => void openDetail(t.id)}
                        style={{ background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }}
                      >
                        <strong style={{ color: "var(--text)" }}>{t.name}</strong>
                        <br />
                        <small style={{ color: "var(--text-muted)" }}>/{t.slug} · {t.members} members</small>
                      </button>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "var(--text-secondary)" }}>{t.plan}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
                      {t.seatsUsed}/{t.seats}
                      {t.seatsUsed >= t.seats && (
                        <span style={{ marginLeft: "var(--p-space-2)", color: "var(--warning-on)", fontSize: "var(--p-type-xs)" }}>at limit</span>
                      )}
                    </td>
                    <td>
                      {badge.variant
                        ? <V3Badge variant={badge.variant}>{badge.label}</V3Badge>
                        : <V3Badge>{badge.label}</V3Badge>}
                    </td>
                    <td style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
                      {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => void openDetail(t.id)}
                        disabled={busy}
                        className="v3-btn"
                        style={{ fontSize: "var(--p-type-xs)", padding: "var(--p-space-2) var(--p-space-3)" }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </V3Card>
      )}

      {/* Tenant detail drawer */}
      {detail && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: "var(--p-z-drawer)" as unknown as number,
            display: "flex",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "var(--scrim)" }}
            onClick={() => setDetail(null)}
            aria-hidden
          />
          <aside
            style={{
              position: "relative", zIndex: 1, marginLeft: "auto",
              display: "flex", flexDirection: "column",
              height: "100%", width: "100%", maxWidth: 480,
              background: "var(--surface)",
              boxShadow: "var(--p-drawer-shadow)",
              borderLeft: "1px solid var(--border)",
            }}
            aria-label={`Tenant detail: ${detail.name}`}
          >
            {/* Drawer header */}
            <div style={{
              height: 56, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 var(--p-space-4)",
              borderBottom: "1px solid var(--border)",
            }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)", fontSize: "var(--p-type-md)", color: "var(--text)", margin: 0 }}>
                <Building2 size={14} aria-hidden style={{ color: "var(--brand)" }} />
                {detail.name}
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close tenant"
                className="v3-btn"
                style={{ padding: "var(--p-space-1) var(--p-space-2)", minHeight: 36, minWidth: 36, fontSize: "var(--p-type-md)" }}
              >×</button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "var(--p-space-4)", display: "flex", flexDirection: "column", gap: "var(--p-space-5)" }}>
              {/* Lifecycle section */}
              <section>
                <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: "0 0 var(--p-space-2)" }}>Lifecycle</h3>
                <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-secondary)", margin: 0 }}>
                  Status: <strong style={{ color: "var(--text)" }}>{detail.status}</strong> · Plan:{" "}
                  <strong style={{ color: "var(--text)" }}>{detail.plan}</strong>
                </p>
                {detail.suspendedReason && (
                  <p style={{
                    marginTop: "var(--p-space-2)", padding: "var(--p-space-3)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--danger-subtle)", color: "var(--danger-on)",
                    fontSize: "var(--p-type-sm)",
                  }}>
                    Suspended: {detail.suspendedReason}
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--p-space-2)", marginTop: "var(--p-space-3)" }}>
                  {detail.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                        void patchTenant(detail.id, { status: "trial", trialEndsAt: end }, "Tenant approved — trial started");
                      }}
                      className="v3-btn v3-btn-success"
                      style={{ fontSize: "var(--p-type-xs)" }}
                    >
                      <CheckCircle2 size={12} aria-hidden /> Approve &amp; start trial
                    </button>
                  )}
                  {detail.status === "suspended" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchTenant(detail.id, { status: "active" }, "Tenant reactivated")}
                      className="v3-btn v3-btn-success"
                      style={{ fontSize: "var(--p-type-xs)" }}
                    >
                      <CheckCircle2 size={12} aria-hidden /> Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Suspension reason (shown to the org):");
                        if (reason) void patchTenant(detail.id, { status: "suspended", suspendedReason: reason }, "Tenant suspended");
                      }}
                      className="v3-btn"
                      style={{ borderColor: "var(--danger)", color: "var(--danger-on)", background: "var(--danger-subtle)", fontSize: "var(--p-type-xs)" }}
                    >
                      <Ban size={12} aria-hidden /> Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                      void patchTenant(detail.id, { trialEndsAt: end }, "Trial extended 30 days");
                    }}
                    className="v3-btn"
                    style={{ fontSize: "var(--p-type-xs)" }}
                  >
                    <Clock size={12} aria-hidden /> Extend trial +30d
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const seats = window.prompt("New seat count:", String(detail.seats));
                      const n = Number(seats);
                      if (seats && Number.isFinite(n) && n > 0) void patchTenant(detail.id, { seats: n }, "Seats updated");
                    }}
                    className="v3-btn"
                    style={{ fontSize: "var(--p-type-xs)" }}
                  >Edit seats</button>
                </div>
                {detail.subscription && (
                  <p style={{ marginTop: "var(--p-space-3)", fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: "var(--p-space-3) 0 0" }}>
                    Stripe subscription: {detail.subscription.status} · {detail.subscription.seats} seats
                    {detail.subscription.currentPeriodEnd
                      ? ` · renews ${new Date(detail.subscription.currentPeriodEnd).toLocaleDateString()}`
                      : ""}
                  </p>
                )}
                <a href="/platform/support" className="v3-btn" style={{ marginTop: "var(--p-space-3)", fontSize: "var(--p-type-xs)" }}>
                  Support tools →
                </a>
              </section>

              {/* Feature rollout */}
              <section>
                <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: "0 0 var(--p-space-2)" }}>Feature rollout (org overrides)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
                  {PORTAL_FLAGS.map((flag) => {
                    const ov = detail.flagOverrides.find((o) => o.key === `feature_portal_${flag}_v2`);
                    return (
                      <div
                        key={flag}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "var(--p-space-2) var(--p-space-3)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                        }}
                      >
                        <span style={{ fontSize: "var(--p-type-sm)", color: "var(--text)" }}>{flag}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)" }}>
                          <span style={{ fontSize: "var(--p-type-xs)", color: "var(--text-muted)" }}>
                            {ov ? "override" : "global"}
                          </span>
                          <Switch
                            checked={ov ? ov.enabled : false}
                            onCheckedChange={(v) => void setFlagOverride(detail.id, `feature_portal_${flag}_v2`, v)}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recent invoices */}
              <section>
                <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: "0 0 var(--p-space-2)" }}>Recent invoices</h3>
                {detail.invoices.length === 0 ? (
                  <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: 0 }}>No invoices yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
                    {detail.invoices.map((i) => (
                      <li key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--p-type-sm)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {new Date(i.createdAt).toLocaleDateString()} · {i.currency} {i.amount.toFixed(2)}
                        </span>
                        <span style={{ fontSize: "var(--p-type-xs)", textTransform: "uppercase", color: "var(--text-muted)" }}>{i.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {busy && (
        <div style={{ pointerEvents: "none", position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: "var(--p-z-modal) as unknown as number" as unknown as number }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--brand)" }} aria-hidden />
        </div>
      )}
    </>
  );
}
