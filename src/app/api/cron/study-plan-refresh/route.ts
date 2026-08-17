/**
 * GET /api/cron/study-plan-refresh — W3 study-flow cron (06:00 UTC).
 *
 * Pre-generates the day's plan for recently active learners so the L12
 * Study-Flow Center renders instantly and the plan reflects the 2h-block
 * + break rules even before first visit. Output is recorded as a
 * `plan.refresh` EngagementEvent (the plan itself is deterministic and
 * rebuilt on demand — we persist the summary, not the rows).
 *
 * No-op until the `study_flow` rollout flag is enabled (cutover plan W3).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";
import { getStudyPlan } from "@/modules/learn/lib/study-flow-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Batch cap keeps the function fast on 60 s limits; tomorrow's run picks
 *  up whatever this one skips. */
const BATCH_SIZE = 200;
const ACTIVE_WINDOW_DAYS = 30;

export async function run() {
    if (!(await isStudyFlowEnabled())) {
    return Response.json({ ok: true, skipped: "flag-off", processed: 0 });
  }

  const startedAt = Date.now();
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);

  // Recently active learners only — refreshes for abandoned enrollments
  // would be noise (absence-scan owns the win-back path).
  const profiles = await db.learnProfile.findMany({
    where: { lastActivityDate: { gte: since } },
    select: { userId: true, courseId: true },
    take: BATCH_SIZE,
    orderBy: { updatedAt: "asc" }, // oldest first so stragglers eventually cycle through
  });

  let processed = 0;
  let failed = 0;

  for (const p of profiles) {
    try {
      const items = await getStudyPlan(p.userId, p.courseId, 30);
      const totalMin = items.reduce((s, i) => s + i.estMin, 0);
      await db.engagementEvent.create({
        data: {
          userId: p.userId,
          courseId: p.courseId,
          eventType: "plan.refresh",
          metadata: { itemCount: items.length, totalMin } as unknown as Prisma.InputJsonValue,
        },
      });
      processed++;
    } catch (err) {
      failed++;
      logger.warn("study-plan-refresh: learner failed", {
        userId: p.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("study-plan-refresh complete", { processed, failed });
  return Response.json({
    ok: true,
    processed,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: NextRequest) {
if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return run();
}
