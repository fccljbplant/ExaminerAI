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

interface PaymentRow {
  id: string;
  courseName: string;
  buyerEmail: string;
  amount: number;
  currency: string;
  createdAt: string;
  refundable: boolean;
}

interface CouponRow {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  courseName: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
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
  const { data, error, isLoading, retry } = useApi<RevenueData & { recentPayments?: PaymentRow[] }>("/api/v2/platform/revenue");
  const { data: queue, retry: retryQueue } = useApi<{
    pending: PayoutRow[];
    recent: PayoutRow[];
  }>("/api/v2/platform/payouts");
  const [sweeping, setSweeping] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);

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

  async function refund(paymentId: string) {
    if (!window.confirm("Refund this payment? The buyer is credited and the course revenue is reversed.")) return;
    setRefundingId(paymentId);
    try {
      const res = await api.post<{ data: { refunded: boolean; amount: number } }>(
        `/api/v2/platform/refunds/${paymentId}`,
      );
      toast.success("Payment refunded", { description: `$${res.data.amount.toFixed(2)} reversed.` });
      void retry();
    } catch (e) {
      toast.error("Refund failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setRefundingId(null);
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

          {/* Recent payments + refunds (2026-08-17) */}
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Recent payments</h2>
            {(data?.recentPayments?.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">No completed payments yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(data?.recentPayments ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="truncate text-fg">{p.courseName}</span>
                      <span className="ml-2 hidden text-xs text-fg-muted sm:inline">{p.buyerEmail}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg">
                      {p.currency} {p.amount.toFixed(2)}
                    </span>
                    <span className="shrink-0 text-xs text-fg-muted">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refund(p.id)}
                      disabled={refundingId === p.id || !p.refundable}
                      title={p.refundable ? "Refund this payment" : "No Stripe intent recorded — refund not possible"}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-line px-2.5 text-xs font-medium text-fg hover:bg-bg-subtle hover:text-danger disabled:opacity-40"
                    >
                      {refundingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refund"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Coupons (2026-08-17) */}
          <CouponsSection onChanged={() => void retry()} />
        </>
      )}
    </div>
  );
}

/** Platform coupon management — the /api/v2/platform/coupons CRUD had no
 *  UI caller; this is the first consumer. */
function CouponsSection({ onChanged }: { onChanged: () => void }) {
  const { data, error, isLoading, retry } = useApi<{ coupons: CouponRow[] }>("/api/v2/platform/coupons");
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(percentOff);
    if (!code.trim() || !Number.isInteger(pct) || pct < 1 || pct > 100) return;
    setBusy(true);
    try {
      await api.post("/api/v2/platform/coupons", {
        code: code.trim().toUpperCase(),
        percentOff: pct,
        maxUses: maxUses ? Number(maxUses) : null,
      });
      toast.success("Coupon created");
      setCode("");
      setPercentOff("");
      setMaxUses("");
      retry();
      onChanged();
    } catch (e) {
      toast.error("Coupon create failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: CouponRow) {
    try {
      await api.patch(`/api/v2/platform/coupons/${c.id}`, { active: !c.active });
      retry();
    } catch (e) {
      toast.error("Update failed", { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Coupons</h2>
        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SAVE20"
            aria-label="Coupon code"
            className="h-9 w-28 rounded-lg border border-line bg-bg px-2 font-mono text-sm uppercase text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            required
          />
          <input
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
            type="number"
            min={1}
            max={100}
            placeholder="% off"
            aria-label="Percent off"
            className="h-9 w-20 rounded-lg border border-line bg-bg px-2 text-sm tabular-nums text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            required
          />
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            type="number"
            min={1}
            placeholder="Max uses"
            aria-label="Max uses"
            className="h-9 w-24 rounded-lg border border-line bg-bg px-2 text-sm tabular-nums text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !code.trim() || !percentOff}
            className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-bg-subtle" aria-busy="true" />
      ) : error ? (
        <p className="mt-2 text-xs text-danger-on">Couldn&apos;t load coupons. <button onClick={() => void retry()} className="underline">Retry</button></p>
      ) : (data?.coupons?.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">No coupons yet — create one above (usable at B2C checkout).</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {(data?.coupons ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-mono font-medium text-fg">{c.code}</span>
                <span className="ml-2 text-xs text-fg-muted">
                  {c.percentOff != null ? `${c.percentOff}% off` : c.amountOff != null ? `$${c.amountOff} off` : ""}
                  {c.courseName ? ` · ${c.courseName}` : " · any course"}
                  {c.maxUses != null ? ` · ${c.usedCount}/${c.maxUses} used` : ` · ${c.usedCount} used`}
                  {c.expiresAt ? ` · until ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void toggle(c)}
                className={
                  c.active
                    ? "inline-flex min-h-8 shrink-0 items-center rounded-md bg-success-subtle px-2.5 text-xs font-semibold text-success-on"
                    : "inline-flex min-h-8 shrink-0 items-center rounded-md bg-bg-subtle px-2.5 text-xs font-semibold text-fg-muted"
                }
              >
                {c.active ? "Active" : "Disabled"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
