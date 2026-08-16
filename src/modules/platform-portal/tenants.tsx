"use client";

import { useEffect, useState } from "react";
import { Ban, Building2, CheckCircle2, Clock, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Switch } from "@/modules/ui/switch";

/**
 * modules/platform-portal — Tenants (2026-08-17 SaaS control plane)
 *
 * Tenant lifecycle roster: search, status/plan/seat overview, and a
 * detail drawer with lifecycle actions (suspend/activate, extend trial,
 * edit seats) plus per-org portal flag overrides — the rollout matrix
 * that pilots features for one org before global enable.
 */

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
    plan: string;
    seats: number;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  invoices: { id: string; amount: number; currency: string; status: string; createdAt: string }[];
  flagOverrides: { key: string; enabled: boolean }[];
}

const PORTAL_FLAGS = ["learner", "study_flow", "submissions", "exams", "instructor", "org", "platform"];

const STATUS_STYLES: Record<string, string> = {
  trial: "bg-info-subtle text-info-on",
  active: "bg-success-subtle text-success-on",
  suspended: "bg-danger-subtle text-danger-on",
  cancelled: "bg-bg-subtle text-fg-muted",
};

export function PlatformTenants() {
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<{ data: { tenants: TenantRow[] } }>(
        `/api/v2/platform/orgs?search=${encodeURIComponent(search)}`,
      );
      setRows(res.data.tenants);
    } catch (e) {
      toast.error("Couldn't load tenants", { description: e instanceof Error ? e.message : undefined });
    }
  };

  useEffect(() => {
    void load();
  }, []);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg md:text-xl">Tenants</h1>
          <p className="text-sm text-fg-muted">Tenant lifecycle, trials, seats and per-org feature rollout.</p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3">
            <Search className="h-4 w-4 text-fg-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or slug…"
              className="w-48 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover"
          >
            Search
          </button>
        </form>
      </div>

      {rows === null ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-fg-muted">
          Loading tenants…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-fg-muted">
          No organizations yet — orgs appear here after B2B signup.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2.5">Organization</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5">Seats</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Trial</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-bg-subtle/50">
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void openDetail(t.id)}
                      className="text-left"
                    >
                      <span className="block font-medium text-fg">{t.name}</span>
                      <span className="block text-xs text-fg-muted">/{t.slug} · {t.members} members</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 capitalize text-fg-secondary">{t.plan}</td>
                  <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
                    {t.seatsUsed}/{t.seats}
                    {t.seatsUsed >= t.seats && <span className="ml-1 text-xs text-warning">at limit</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[t.status] ?? "bg-bg-subtle")}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-fg-muted">
                    {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(t.id)}
                      disabled={busy}
                      className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-fg hover:bg-bg-subtle disabled:opacity-50"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tenant detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-[var(--p-z-drawer)] flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative z-10 ml-auto flex h-full w-full max-w-md flex-col border-l border-line bg-background shadow-xl">
            <div className="flex h-12 flex-shrink-0 items-center justify-between border-b px-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Building2 className="h-4 w-4 text-brand" aria-hidden />
                {detail.name}
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-bg-subtle"
                aria-label="Close tenant"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Lifecycle</h3>
                <p className="text-sm text-fg-secondary">
                  Status: <span className="font-medium text-fg">{detail.status}</span> · Plan:{" "}
                  <span className="font-medium text-fg">{detail.plan}</span>
                </p>
                {detail.suspendedReason && (
                  <p className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-on">
                    Suspended: {detail.suspendedReason}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {detail.status === "suspended" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchTenant(detail.id, { status: "active" }, "Tenant reactivated")}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Suspension reason (shown to the org):");
                        if (reason) void patchTenant(detail.id, { status: "suspended", suspendedReason: reason }, "Tenant suspended");
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" aria-hidden /> Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                      void patchTenant(detail.id, { trialEndsAt: end }, "Trial extended 30 days");
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:bg-bg-subtle disabled:opacity-50"
                  >
                    <Clock className="h-4 w-4" aria-hidden /> Extend trial +30d
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const seats = window.prompt("New seat count:", String(detail.seats));
                      const n = Number(seats);
                      if (seats && Number.isFinite(n) && n > 0) void patchTenant(detail.id, { seats: n }, "Seats updated");
                    }}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:bg-bg-subtle disabled:opacity-50"
                  >
                    Edit seats
                  </button>
                </div>
                {detail.subscription && (
                  <p className="text-xs text-fg-muted">
                    Stripe subscription: {detail.subscription.status} · {detail.subscription.seats} seats
                    {detail.subscription.currentPeriodEnd
                      ? ` · renews ${new Date(detail.subscription.currentPeriodEnd).toLocaleDateString()}`
                      : ""}
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Feature rollout (org overrides)</h3>
                {PORTAL_FLAGS.map((flag) => {
                  const ov = detail.flagOverrides.find((o) => o.key === `feature_portal_${flag}_v2`);
                  return (
                    <div key={flag} className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2">
                      <span className="text-sm text-fg">{flag}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-fg-muted">{ov ? "override" : "global"}</span>
                        <Switch
                          checked={ov ? ov.enabled : false}
                          onCheckedChange={(v) => void setFlagOverride(detail.id, `feature_portal_${flag}_v2`, v)}
                        />
                      </span>
                    </div>
                  );
                })}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Recent invoices</h3>
                {detail.invoices.length === 0 ? (
                  <p className="text-sm text-fg-muted">No invoices yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.invoices.map((i) => (
                      <li key={i.id} className="flex items-center justify-between text-sm">
                        <span className="text-fg-secondary">
                          {new Date(i.createdAt).toLocaleDateString()} · {i.currency} {i.amount.toFixed(2)}
                        </span>
                        <span className="text-xs uppercase text-fg-muted">{i.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
      {busy && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
        </div>
      )}
    </div>
  );
}
