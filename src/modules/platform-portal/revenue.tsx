"use client";

import { useState } from "react";
import { Banknote, Clock, Loader2, Send, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/platform-portal — Revenue & Payouts (2026-08-17 SaaS P&L)
 *
 * MRR / B2C fees / payout queue / trial health / AI spend — the numbers
 * the platform business actually runs on — plus manual payout sweep and
 * trial-ending list.
 */

interface RevenueData {
  mrr: number;
  pipelineMrr: number;
  b2cGross30d: number;
  platformFees30d: number;
  payments30d: number;
  refunded30d: number;
  payoutsPending: { count: number; sum: number };
  aiSpend30d: number;
  trialsEnding7d: { id: string; name: string; trialEndsAt: string | null }[];
  subscriptionStates: Record<string, number>;
}

interface PayoutRow {
  id: string;
  instructorEmail: string;
  instructorName: string;
  amount: number;
  status: string;
  stripeTransferId: string | null;
  scheduledFor: string | null;
  createdAt: string;
}

function Card({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof Banknote }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-fg">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-fg-muted">{sub}</p>}
    </div>
  );
}

export function PlatformRevenue() {
  const { data, error, isLoading, retry } = useApi<RevenueData>("/api/v2/platform/revenue");
  const { data: queue, retry: retryQueue } = useApi<{
    pending: PayoutRow[];
    recent: PayoutRow[];
  }>("/api/v2/platform/payouts");
  const [sweeping, setSweeping] = useState(false);

  async function sweep() {
    setSweeping(true);
    try {
      const res = await api.post<{ data: { paid: number; failed: number; deferred: number; due: number } }>(
        "/api/v2/platform/payouts",
        { action: "sweep" },
      );
      toast.success(`Sweep done — ${res.data.paid} paid, ${res.data.failed} failed, ${res.data.deferred} deferred`);
      void retryQueue();
    } catch (e) {
      toast.error("Sweep failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSweeping(false);
    }
  }

  const revenue = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg md:text-xl">Revenue &amp; payouts</h1>
          <p className="text-sm text-fg-muted">MRR, platform fees, creator payouts and trial health.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void retry()}
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg hover:bg-bg-subtle"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void sweep()}
            disabled={sweeping}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            {sweeping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Run payout sweep
          </button>
        </div>
      </div>

      {isLoading && <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />}
      {error && (
        <div role="alert" className="rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          Couldn&apos;t load revenue. <button type="button" onClick={() => void retry()} className="underline">Retry</button>
        </div>
      )}

      {revenue && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card label="MRR" value={`$${revenue.mrr.toLocaleString()}`} sub={`+$${revenue.pipelineMrr.toLocaleString()} trialing`} icon={TrendingUp} />
            <Card label="Platform fees (30d)" value={`$${revenue.platformFees30d.toLocaleString()}`} sub={`${revenue.payments30d} payments`} icon={Banknote} />
            <Card label="Payouts pending" value={`$${revenue.payoutsPending.sum.toLocaleString()}`} sub={`${revenue.payoutsPending.count} payouts`} icon={Clock} />
            <Card label="AI spend (30d)" value={`$${revenue.aiSpend30d.toLocaleString()}`} sub="estimated cost" icon={Zap} />
            <Card label="Refunds (30d)" value={String(revenue.refunded30d)} sub={`B2C gross $${revenue.b2cGross30d.toLocaleString()}`} icon={Banknote} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">Payout queue</h2>
              {(queue?.pending ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-fg-muted">No pending payouts.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(queue?.pending ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-fg">{p.instructorEmail}</span>
                      <span className="shrink-0 tabular-nums text-fg">${p.amount.toFixed(2)}</span>
                      <span className="shrink-0 text-xs text-fg-muted">
                        {p.scheduledFor ? new Date(p.scheduledFor).toLocaleDateString() : "manual"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg-muted">Recent</h3>
              <ul className="mt-1 space-y-1.5">
                {(queue?.recent ?? []).slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs text-fg-secondary">
                    <span className="truncate">{p.instructorEmail}</span>
                    <span className="tabular-nums">${p.amount.toFixed(2)}</span>
                    <span className={p.status === "paid" ? "text-success" : "text-danger"}>{p.status}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">Trials ending (7d)</h2>
              {revenue.trialsEnding7d.length === 0 ? (
                <p className="mt-2 text-sm text-fg-muted">No trials ending this week.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {revenue.trialsEnding7d.map((t) => (
                    <li key={t.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-fg">{t.name}</span>
                      <span className="shrink-0 text-xs text-warning">
                        {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-fg-muted">Subscriptions</h3>
              <p className="mt-1 text-sm text-fg-secondary">
                {Object.entries(revenue.subscriptionStates).length === 0
                  ? "No subscriptions yet."
                  : Object.entries(revenue.subscriptionStates)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
