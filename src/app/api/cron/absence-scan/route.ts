/**
 * GET /api/cron/absence-scan — W3 study-flow cron (07:00 UTC).
 *
 * Scans for learners whose last activity is 3+ days old, classifies the
 * absence with `detectAbsence`, and for short/long absences creates:
 *   1. a Notification (bell) linking to /learner/study, and
 *   2. an `absence.notified` EngagementEvent — both the dedupe marker
 *      and the signal the tutor's proactive offer rides on.
 *
 * Copy is warm and guilt-free per the psychological-cycle spec. Dedupe
 * window is 7 days so a learner away for two weeks gets at most two
 * nudges. No-op until the `study_flow` rollout flag is enabled.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";
import { detectAbsence } from "@/modules/learn/lib/study-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 200;
const DEDUPE_WINDOW_DAYS = 7;

const COPY = {
  short: {
    title: "We saved your spot",
    body: "A few lessons passed you by — jump back in with a plan that fits your time today.",
  },
  long: {
    title: "Welcome back when you're ready",
    body: "A quick 10-question check will find the perfect spot to restart. No grades, no pressure.",
  },
} as const;

export async function run() {
    if (!(await isStudyFlowEnabled())) {
    return Response.json({ ok: true, skipped: "flag-off", processed: 0 });
  }

  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - 3 * 86_400_000);
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000);

  const candidates = await db.learnProfile.findMany({
    where: { lastActivityDate: { lt: cutoff } },
    select: { userId: true, courseId: true, lastActivityDate: true },
    take: BATCH_SIZE,
    orderBy: { lastActivityDate: "asc" },
  });

  let notified = 0;
  let skipped = 0;

  for (const p of candidates) {
    const absence = detectAbsence(p.lastActivityDate);
    if (absence.level === "none") {
      skipped++;
      continue;
    }

    // Dedupe: one nudge per user+course per window.
    const recentNotice = await db.engagementEvent.findFirst({
      where: {
        userId: p.userId,
        courseId: p.courseId,
        eventType: "absence.notified",
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (recentNotice) {
      skipped++;
      continue;
    }

    const copy = COPY[absence.level];
    await db.notification.create({
      data: {
        userId: p.userId,
        type: "study_flow",
        title: copy.title,
        body: copy.body,
        link: "/learner/study",
      },
    });
    await db.engagementEvent.create({
      data: {
        userId: p.userId,
        courseId: p.courseId,
        eventType: "absence.notified",
        metadata: {
          level: absence.level,
          daysSince: absence.daysSince,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    notified++;
  }

  logger.info("absence-scan complete", { notified, skipped });
  return Response.json({
    ok: true,
    notified,
    skipped,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: NextRequest) {
if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return run();
}
