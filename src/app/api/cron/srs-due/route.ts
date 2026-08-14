/**
 * GET /api/cron/srs-due — W3 study-flow cron (03:00 UTC).
 *
 * Replaces the legacy drill-scheduler: due dates are now computed purely
 * by `srsSchedule()` at review time, so this cron only handles the
 * morning heads-up — one bell notification per learner with due cards
 * ("You have N reviews due"), deduped daily via an `srs.notified`
 * EngagementEvent. No-op until the `study_flow` rollout flag is enabled.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cards scanned per run (grouped down to users afterwards). */
const CARD_BATCH = 500;
const MAX_USERS = 200;
const DEDUPE_HOURS = 20;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isStudyFlowEnabled())) {
    return Response.json({ ok: true, skipped: "flag-off", processed: 0 });
  }

  const startedAt = Date.now();
  const dedupeSince = new Date(Date.now() - DEDUPE_HOURS * 3_600_000);

  const dueCards = await db.drillCard.findMany({
    where: { dueAt: { lte: new Date() }, masteredAt: null },
    select: { userId: true },
    take: CARD_BATCH,
  });

  // Group to one notification per learner.
  const dueCountByUser = new Map<string, number>();
  for (const c of dueCards) {
    dueCountByUser.set(c.userId, (dueCountByUser.get(c.userId) ?? 0) + 1);
  }

  let notified = 0;
  let skipped = 0;

  for (const [userId, count] of dueCountByUser) {
    if (notified >= MAX_USERS) break;

    const recentNotice = await db.engagementEvent.findFirst({
      where: {
        userId,
        eventType: "srs.notified",
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (recentNotice) {
      skipped++;
      continue;
    }

    await db.notification.create({
      data: {
        userId,
        type: "study_flow",
        title: count === 1 ? "1 review is due" : `${count} reviews are due`,
        body: "Quick recall practice keeps what you've learned from fading. It takes just a few minutes.",
        link: "/learner/study",
      },
    });
    await db.engagementEvent.create({
      data: {
        userId,
        eventType: "srs.notified",
        metadata: { count } as unknown as Prisma.InputJsonValue,
      },
    });
    notified++;
  }

  logger.info("srs-due complete", { notified, skipped });
  return Response.json({
    ok: true,
    notified,
    skipped,
    durationMs: Date.now() - startedAt,
  });
}
