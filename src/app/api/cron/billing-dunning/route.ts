/**
 * GET /api/cron/billing-dunning — B2B dunning cron (past-due subscriptions).
 *
 * For every Subscription with status "past_due", notify each active
 * OrgMember with role "admin" (Payment failed + link to /org/billing).
 * Notifications are in-app rows; no external email dependency.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORG_BATCH = 100;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const subscriptions = await db.subscription.findMany({
    where: { status: "past_due" },
    select: { orgId: true, plan: true, org: { select: { name: true } } },
    take: ORG_BATCH,
  });

  let notified = 0;
  for (const sub of subscriptions) {
    const admins = await db.orgMember.findMany({
      where: { orgId: sub.orgId, role: "admin", status: "active" },
      select: { userId: true },
    });
    for (const admin of admins) {
      await sendNotification({
        userId: admin.userId,
        type: "payment_failed",
        title: "Payment failed",
        body: `The ${sub.plan} subscription for ${sub.org.name} has a past-due invoice. Update your payment details to keep the workspace active.`,
        link: "/org/billing",
      });
      notified++;
    }
  }

  logger.info("billing-dunning complete", {
    orgs: subscriptions.length,
    notified,
  });
  return Response.json({
    ok: true,
    orgs: subscriptions.length,
    notified,
    durationMs: Date.now() - startedAt,
  });
}
