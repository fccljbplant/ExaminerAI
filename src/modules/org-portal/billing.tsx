"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, RefreshCw, Rocket } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O6 Billing & seats (REDESIGN-P3 §O6, W7)
 *
 * Plan card + seat usage bar + recent member payments. B2B enterprise
 * ops (2026-08-17): real Stripe upgrade — one plan card per tier with a
 * seats input (floor = the tier's minimum) that POSTs
 * /api/v2/org/billing { plan, seats } and follows the checkout URL.
 */

interface BillingData {
  plan: string;
  seats: number;
  seatsUsed: number;
  seatsPct: number;
  recentPayments: Array<{
    id: string;
    courseName: string;
    amount: number;
    currency: string;
    createdAt: string;
  }>;
}

const SEAT_PRICE_USD = 29;

const PLANS = [
  { id: "starter", label: "Starter", minSeats: 5, blurb: "Small teams getting started" },
  { id: "team", label: "Team", minSeats: 50, blurb: "Growing departments" },
  { id: "business", label: "Business", minSeats: 200, blurb: "Scaling training programs" },
  { id: "enterprise", label: "Enterprise", minSeats: 500, blurb: "Company-wide compliance" },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

export function OrgBilling() {
  const { data, error, isLoading, retry } = useApi<BillingData>("/api/v2/org/billing");
  const [seatsInput, setSeatsInput] = useState<Record<PlanId, string>>(() =>
    Object.fromEntries(PLANS.map((p) => [p.id, String(p.minSeats)])) as Record<PlanId, string>,
  );
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);

  async function upgrade(plan: PlanId) {
    const seats = Number(seatsInput[plan]);
    const minSeats = PLANS.find((p) => p.id === plan)?.minSeats ?? 1;
    if (!Number.isInteger(seats) || seats < minSeats) {
      toast.error(`The ${plan} plan starts at ${minSeats} seats`);
      return;
    }
    setBusyPlan(plan);
    try {
      const envelope = await api.post<{ ok: boolean; data: { url: string | null } }>(
        "/api/v2/org/billing",
        { plan, seats },
      );
      const url = envelope.data?.url;
      if (!url) {
        toast.error("Checkout unavailable", {
          description: "Stripe is not configured on this server.",
        });
        return;
      }
      window.location.href = url;
    } catch (err) {
      toast.error("Couldn't start checkout", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusyPlan(null);
    }
  }

  if (isLoading) return <BillingSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load billing</p>
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
      <h1 className="text-lg font-semibold text-fg md:text-xl">Billing & seats</h1>

      {/* plan card */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg capitalize">{data.plan} plan</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {data.seats} seats · {data.seatsUsed} in use
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle text-fg">
            <CreditCard className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${data.seatsPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          {data.seatsPct >= 90
            ? "Seats are nearly full — free a seat in People or upgrade."
            : "Manage seats from the People tab."}
        </p>
      </div>

      {/* upgrade plans */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Upgrade plan
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const current = data.plan === plan.id;
            const seats = Number(seatsInput[plan.id]) || plan.minSeats;
            return (
              <div
                key={plan.id}
                className={
                  current
                    ? "flex flex-col gap-2 rounded-xl border border-brand bg-brand-subtle/40 p-4"
                    : "flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-fg">{plan.label}</p>
                  {current && (
                    <span className="rounded-md bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-brand">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-fg-muted">{plan.blurb}</p>
                <p className="text-xs text-fg-secondary">
                  {plan.minSeats}+ seats ·{" "}
                  <span className="font-medium text-fg">
                    ${SEAT_PRICE_USD}/seat/mo
                  </span>
                </p>
                <label className="flex items-center gap-2 text-xs text-fg-muted">
                  Seats
                  <input
                    type="number"
                    min={plan.minSeats}
                    value={seatsInput[plan.id]}
                    onChange={(e) =>
                      setSeatsInput((prev) => ({ ...prev, [plan.id]: e.target.value }))
                    }
                    aria-label={`Seats for ${plan.label} plan`}
                    className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums text-fg focus:border-brand focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={busyPlan === plan.id}
                  onClick={() => void upgrade(plan.id)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  <Rocket className="h-3.5 w-3.5" aria-hidden />
                  {busyPlan === plan.id
                    ? "Opening checkout…"
                    : current
                      ? `Upgrade · $${(seats * SEAT_PRICE_USD).toLocaleString()}/mo`
                      : `Switch · $${(seats * SEAT_PRICE_USD).toLocaleString()}/mo`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-fg-muted">
          Plans renew monthly. Seats below the tier minimum are rounded up at checkout.
        </p>
      </section>

      {/* recent payments */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Recent member payments
        </h2>
        {data.recentPayments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No member payments yet — marketplace purchases by org members appear here.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{p.courseName}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">
                  {p.amount.toLocaleString()} {p.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="h-36 rounded-xl bg-bg-subtle" />
      <div className="h-48 rounded-xl bg-bg-subtle" />
    </div>
  );
}
