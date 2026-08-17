/**
 * GET /api/cron/payouts-sweep — monthly creator payout sweep.
 *
 * Processes Payout rows with status "pending" and scheduledFor <= now:
 * instructors with a Stripe Connect account get a real transfer
 * (createPayoutTransfer) and the row becomes "paid" (or "failed" when
 * the transfer fails / Stripe is unconfigured); rows without a connected
 * account stay "pending" for the next run. Idempotent by row status.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createPayoutTransfer } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function run() {
    const due = await db.payout.findMany({
    where: {
      status: "pending",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    include: { instructor: { select: { stripeAccountId: true } } },
    take: 200,
  });

  let paid = 0;
  let failed = 0;
  let deferred = 0;

  for (const payout of due) {
    const accountId = payout.instructor.stripeAccountId;
    if (!accountId) {
      deferred++;
      continue;
    }
    try {
      const transfer = await createPayoutTransfer({
        stripeAccountId: accountId,
        amountUsd: payout.amount,
        description: `TraineesAI payout ${payout.id.slice(-8)}`,
      });
      if (transfer) {
        await db.payout.update({
          where: { id: payout.id },
          data: { status: "paid", stripeTransferId: transfer.transferId },
        });
        paid++;
      } else {
        // Stripe not configured — leave pending for the next sweep.
        deferred++;
      }
    } catch (err) {
      logger.error("payout sweep transfer failed", { payoutId: payout.id, err });
      await db.payout.update({ where: { id: payout.id }, data: { status: "failed" } }).catch(() => {});
      failed++;
    }
  }

  return Response.json({ ok: true, data: { due: due.length, paid, failed, deferred } });
}

export async function GET(req: NextRequest) {
if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return run();
}
