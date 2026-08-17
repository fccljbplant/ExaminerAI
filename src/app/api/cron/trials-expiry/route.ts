/**
 * GET /api/cron/trials-expiry — org trial expiry nudges (daily).
 *
 * For every org still in `trial` status whose trialEndsAt is within the
 * next 7 days (or already passed), notifies each OrgMember with role
 * "admin" (Notification type "payment_failed" is NOT used — this is
 * "message_received" with link /org/billing). Deduped: same-title
 * notification for the user must be older than 6 days. Non-destructive:
 * the platform admin converts trials via Platform → Tenants.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEDUPE_DAYS = 6;

export async function run() {
    const now = Date.now();
  const soon = new Date(now + 7 * 86_400_000);
  const orgs = await db.organization.findMany({
    where: {
      status: "trial",
      trialEndsAt: { not: null },
    },
    select: { id: true, name: true, trialEndsAt: true, members: { where: { role: "admin", status: "active" }, select: { userId: true } } },
  });

  const dedupeSince = new Date(now - DEDUPE_DAYS * 86_400_000);
  let notified = 0;

  for (const org of orgs) {
    if (!org.trialEndsAt) continue;
    const endsAt = org.trialEndsAt.getTime();
    if (endsAt > soon.getTime()) continue; // not within the window

    const expired = endsAt <= now;
    const days = Math.max(0, Math.ceil((endsAt - now) / 86_400_000));
    const title = expired ? "Trial expired — upgrade to keep training" : `Trial ends in ${days}d`;
    const body = expired
      ? `${org.name}'s trial has ended. Upgrade from the billing page to keep seats and training active.`
      : `${org.name}'s trial ends soon. Upgrade before it lapses to keep every seat active.`;

    for (const member of org.members) {
      try {
        const last = await db.notification.findFirst({
          where: { userId: member.userId, title, createdAt: { gte: dedupeSince } },
          select: { id: true },
        });
        if (last) continue;
        await db.notification.create({
          data: {
            userId: member.userId,
            type: "message_received",
            title,
            body,
            link: "/org/billing",
          },
        });
        notified++;
      } catch (err) {
        logger.warn("trials-expiry notification failed", { orgId: org.id, err });
      }
    }
  }

  return Response.json({ ok: true, data: { orgsChecked: orgs.length, notified } });
}

export async function GET(req: NextRequest) {
if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return run();
}
