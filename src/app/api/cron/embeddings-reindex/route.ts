/**
 * GET /api/cron/embeddings-reindex — nightly RAG index delta.
 *
 * Finds published courses that have content (slides or uploaded
 * materials) but no CourseEmbedding rows yet (or a stale index) and
 * re-indexes them — capped per run so a cold start never wedges the
 * cron. Runs as part of the saas-daily fan-out.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isCronAuthorized } from "@/lib/cron-auth";
import { indexCourse } from "@/modules/ai/lib/rag-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COURSES_PER_RUN = 20;

export async function run() {
  const candidates = await db.course.findMany({
    where: {
      published: true,
      embeddings: { none: {} },
      OR: [{ learnSlides: { some: {} } }, { materials: { some: {} } }],
    },
    select: { id: true, name: true },
    take: MAX_COURSES_PER_RUN,
  });

  let indexed = 0;
  let skipped = 0;
  for (const course of candidates) {
    try {
      const result = await indexCourse(course.id);
      indexed += result.indexed > 0 ? 1 : 0;
      if (result.indexed === 0) skipped++;
    } catch (err) {
      logger.warn("embeddings-reindex failed for course", { courseId: course.id, err });
      skipped++;
    }
  }

  return Response.json({
    ok: true,
    scanned: candidates.length,
    indexed,
    skipped,
    courseNames: candidates.map((c) => c.name),
  });
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return run();
}
