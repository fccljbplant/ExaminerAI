"use client";

import { AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O6 Billing & seats (REDESIGN-P3 §O6, W7)
 *
 * Plan card + seat usage bar + recent member payments. The upgrade CTA
 * connects to the existing Stripe checkout in a later pass — for now
 * the plan is read-only and seats are managed from People.
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

export function OrgBilling() {
  const { data, error, isLoading, retry } = useApi<BillingData>("/api/v2/org/billing");

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
