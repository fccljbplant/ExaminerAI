"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";
import { Button } from "@/modules/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/modules/ui/card";

/**
 * modules/instructor-portal — InstructorPayouts (creator economy,
 * 2026-08-17).
 *
 * Stripe Connect onboarding banner (until User.stripeAccountId exists),
 * available balance + request-payout CTA, and payout history via
 * /api/v2/instructor/payouts. Onboarding redirects to Stripe via
 * /api/stripe/connect/onboard.
 */

interface PayoutView {
  id: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  stripeTransferId: string | null;
  scheduledFor: string | null;
  createdAt: string;
}

interface PayoutsData {
  availableBalance: number;
  hasConnectAccount: boolean;
  payouts: PayoutView[];
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

const STATUS_CHIP: Record<PayoutView["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success-subtle text-success-on" },
  pending: { label: "Pending", className: "bg-bg-subtle text-fg-secondary" },
  failed: { label: "Failed", className: "bg-danger-subtle text-danger-on" },
};

export function InstructorPayouts() {
  const { data, error, isLoading, retry } = useApi<PayoutsData>(
    "/api/v2/instructor/payouts",
  );
  const [requesting, setRequesting] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  async function requestPayout() {
    setRequesting(true);
    try {
      const res = await api.post<Envelope<{ payout?: PayoutView; deferred?: boolean }>>(
        "/api/v2/instructor/payouts",
        {},
      );
      if (!res.ok) throw new Error(res.error ?? "Payout request failed");
      const amount = res.data?.payout?.amount ?? 0;
      if (res.data?.deferred) {
        toast.success("Payout scheduled", {
          description: `$${fmt(amount)} will be sent on the first day of next month.`,
        });
      } else {
        toast.success("Payout sent", {
          description: `$${fmt(amount)} was transferred to your Stripe account.`,
        });
      }
      retry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payout request failed");
    } finally {
      setRequesting(false);
    }
  }

  async function startOnboarding() {
    setOnboarding(true);
    try {
      const res = await api.post<Envelope<{ url?: string }>>(
        "/api/stripe/connect/onboard",
        {},
      );
      if (!res.ok) throw new Error(res.error ?? "Stripe onboarding failed");
      const url = res.data?.url;
      if (!url) throw new Error("Stripe onboarding failed");
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stripe onboarding failed");
      setOnboarding(false);
    }
  }

  if (isLoading) return <PayoutsSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load payouts</p>
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
      <h1 className="text-lg font-semibold text-fg md:text-xl">Payouts</h1>

      {!data.hasConnectAccount && (
        <Card className="gap-3 border-line bg-surface">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-semibold text-fg">
              Connect Stripe to get paid
            </CardTitle>
            <CardDescription className="text-xs text-fg-muted">
              Onboard with Stripe Connect once and your earnings will transfer
              straight to your bank account when you request a payout.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Button type="button" onClick={() => void startOnboarding()} disabled={onboarding}>
              {onboarding ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ExternalLink className="h-4 w-4" aria-hidden />
              )}
              {onboarding ? "Opening Stripe…" : "Onboard with Stripe"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-line bg-surface">
        <CardHeader className="px-5">
          <CardTitle className="text-sm font-semibold text-fg">Available balance</CardTitle>
          <CardDescription className="text-xs text-fg-muted">
            Completed sales minus payouts you&apos;ve already requested.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-3xl font-semibold tabular-nums text-fg">
            ${fmt(data.availableBalance)}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void requestPayout()}
            disabled={requesting || data.availableBalance <= 0}
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="h-4 w-4" aria-hidden />
            )}
            {requesting ? "Requesting…" : "Request payout"}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Payout history
        </h2>
        {data.payouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
            No payouts yet — request your first one above.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.payouts.map((p) => (
              <div key={p.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                  <Wallet className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums text-fg">
                    ${fmt(p.amount)}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {fmtDate(p.createdAt)}
                    {p.status === "pending" && p.scheduledFor
                      ? ` · scheduled ${fmtDate(p.scheduledFor)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    STATUS_CHIP[p.status].className,
                  )}
                >
                  {STATUS_CHIP[p.status].label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PayoutsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-32 rounded-md bg-bg-subtle" />
      <div className="h-28 rounded-xl bg-bg-subtle" />
      <div className="h-40 rounded-xl bg-bg-subtle" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
