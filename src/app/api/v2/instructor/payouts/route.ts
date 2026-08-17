/**
 * GET / POST /api/v2/instructor/payouts — creator-economy payouts
 * (2026-08-17).
 *
 * Auth: instructor only (literal role check, matching the portal).
 *
 * GET:
 *   - availableBalance: sum of completed Payment.instructorShare minus
 *     payouts already requested (pending/paid — they reserve the balance).
 *   - payouts: latest 50, ISO dates.
 *   - hasConnectAccount: whether the instructor onboarded with Stripe
 *     Connect (User.stripeAccountId set) — drives the client's banner.
 *
 * POST body { amount?: number }:
 *   - no amount → full available balance.
 *   - validates amount > 0 and <= availableBalance (400 INVALID_AMOUNT).
 *   - connected account → immediate Stripe transfer, Payout "paid".
 *   - otherwise (or Stripe unconfigured → helper null) → Payout
 *     "pending" scheduled for the first day of next month, deferred.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, ErrorCode } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { isPortalEnabled } from "@/lib/feature-flags";
import { createPayoutTransfer } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/** Round to 2 decimal places — avoids float drift in JS sums. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** First day of next month (UTC midnight) — when pending payouts run. */
function firstDayOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Completed earnings minus payouts already requested (pending/paid). */
async function availableBalanceFor(instructorId: string): Promise<number> {
  const [earned, reserved] = await Promise.all([
    db.payment.aggregate({
      where: { instructorId, status: "completed" },
      _sum: { instructorShare: true },
    }),
    db.payout.aggregate({
      where: { instructorId, status: { in: ["pending", "paid"] } },
      _sum: { amount: true },
    }),
  ]);
  return round2(
    Math.max(0, (earned._sum.instructorShare ?? 0) - (reserved._sum.amount ?? 0)),
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "instructor") {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  try {
    const [availableBalance, payouts, profile] = await Promise.all([
      availableBalanceFor(user.sub),
      db.payout.findMany({
        where: { instructorId: user.sub },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.user.findUnique({
        where: { id: user.sub },
        select: { stripeAccountId: true },
      }),
    ]);

    return apiSuccess({
      availableBalance,
      hasConnectAccount: Boolean(profile?.stripeAccountId),
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        stripeTransferId: p.stripeTransferId,
        scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("Failed to load instructor payouts", {
      userId: user.sub,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Failed to load payouts", "INTERNAL_ERROR", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "instructor") {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("requesting a payout");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => ({}));
  const requested = (body as { amount?: unknown }).amount;

  try {
    const availableBalance = await availableBalanceFor(user.sub);
    const amount =
      requested === undefined || requested === null
        ? availableBalance
        : Number(requested);

    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError(
        "Amount must be greater than zero",
        ErrorCode.INVALID_AMOUNT,
        400,
      );
    }
    if (amount > availableBalance) {
      return apiError(
        `Amount exceeds your available balance of ${availableBalance.toFixed(2)}`,
        ErrorCode.INVALID_AMOUNT,
        400,
      );
    }
    const rounded = round2(amount);

    const profile = await db.user.findUnique({
      where: { id: user.sub },
      select: { stripeAccountId: true },
    });

    let stripeTransferId: string | null = null;
    let deferred = false;

    if (profile?.stripeAccountId) {
      // Attempt the immediate transfer. A null result means Stripe is not
      // configured — degrade to a scheduled (pending) payout instead.
      const transfer = await createPayoutTransfer({
        stripeAccountId: profile.stripeAccountId,
        amountUsd: rounded,
        description: `TraineesAI payout — ${user.email}`,
      });
      if (transfer) {
        stripeTransferId = transfer.transferId;
      } else {
        deferred = true;
      }
    } else {
      deferred = true;
    }

    const payout = await db.payout.create({
      data: {
        instructorId: user.sub,
        amount: rounded,
        status: stripeTransferId ? "paid" : "pending",
        ...(stripeTransferId
          ? { stripeTransferId }
          : { scheduledFor: firstDayOfNextMonth() }),
      },
    });

    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "payout_requested",
      target: { type: "payout", id: payout.id },
      after: {
        amount: payout.amount,
        status: payout.status,
        stripeTransferId: payout.stripeTransferId ?? null,
        scheduledFor: payout.scheduledFor?.toISOString() ?? null,
      },
      req,
    });

    return apiSuccess({
      payout: {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        stripeTransferId: payout.stripeTransferId,
        scheduledFor: payout.scheduledFor ? payout.scheduledFor.toISOString() : null,
        createdAt: payout.createdAt.toISOString(),
      },
      deferred,
    });
  } catch (err) {
    logger.error("Failed to request instructor payout", {
      userId: user.sub,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Failed to request payout", "INTERNAL_ERROR", 500);
  }
}
