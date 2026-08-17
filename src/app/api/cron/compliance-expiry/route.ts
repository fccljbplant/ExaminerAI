/**
 * GET /api/cron/compliance-expiry — B2B compliance expiry cron.
 *
 * Every enrollment with an expiresAt within the next 14 days OR already
 * expired gets one "Training due" notification per learner per course
 * per week. Dedupe: the most recent training_due notification for that
 * user with the course link (Notification has no metadata column, so the
 * courseId rides in the link field) within the last 7 days.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN_BATCH = 500;
const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function run() {
    const startedAt = Date.now();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
  const dedupeSince = new Date(now.getTime() - DEDUPE_WINDOW_MS);

  const enrollments = await db.courseEnrollment.findMany({
    where: { expiresAt: { not: null, lte: windowEnd } },
    select: { userId: true, courseId: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
    take: SCAN_BATCH,
  });

  if (enrollments.length === 0) {
    return Response.json({ ok: true, scanned: 0, notified: 0, skipped: 0 });
  }

  // Course names in one batch (cron nudges mention the course by name).
  const courseIds = [...new Set(enrollments.map((e) => e.courseId))];
  const courses = await db.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, name: true },
  });
  const nameByCourse = new Map(courses.map((c) => [c.id, c.name]));

  let notified = 0;
  let skipped = 0;

  for (const e of enrollments) {
    const link = `/learn/${e.courseId}`;
    const recent = await db.notification.findFirst({
      where: {
        userId: e.userId,
        type: "training_due",
        link,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (recent) {
      skipped++;
      continue;
    }

    const courseName = nameByCourse.get(e.courseId) ?? "this course";
    const expired = e.expiresAt !== null && e.expiresAt.getTime() < now.getTime();
    await sendNotification({
      userId: e.userId,
      type: "training_due",
      title: "Training due",
      body: expired
        ? `Your training for ${courseName} has expired. Please retake it to stay compliant.`
        : `Your training for ${courseName} expires soon. Please complete it to stay compliant.`,
      link,
    });
    notified++;
  }

  logger.info("compliance-expiry complete", { notified, skipped, scanned: enrollments.length });
  return Response.json({
    ok: true,
    scanned: enrollments.length,
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
