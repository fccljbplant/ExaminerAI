/**
 * GET /api/v2/instructor/home — I1 Home aggregate (REDESIGN-P4 §2 I1, W6)
 *
 * One request feeds the instructor home fold: queue count + queue
 * preview, at-risk count + list, and the roster total. All scoped to
 * courses the instructor teaches (same scope as reviewQueue/students).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";
import { reviewQueue } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { GET as GET_Students } from "../students/route";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Submissions are not enabled yet", "FORBIDDEN", 403);
  }

  // Keep KPI totals independent of the five-row preview.
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  const queueWhere = {
    assignment: { courseId: { in: courseIds } },
  };
  const [queueCount, inReviewCount, queue] = await Promise.all([
    db.submission.count({
      where: {
        ...queueWhere,
        status: { in: ["submitted", "in_review", "resubmitted", "changes_requested"] },
      },
    }),
    db.submission.count({
      where: { ...queueWhere, status: "in_review" },
    }),
    reviewQueue(user.sub, { limit: 5 }),
  ]);
  const { items } = queue;

  // At-risk roster: compose the students route in-process (no HTTP hop).
  // Do not turn a roster failure into a convincing but false zero-state.
  const rosterUrl = new URL(req.url);
  rosterUrl.pathname = "/api/v2/instructor/students";
  rosterUrl.search = "risk=1";
  const studentsRes = await GET_Students(new NextRequest(rosterUrl, { method: "GET" }));
  if (!studentsRes.ok) {
    console.error("Instructor home roster aggregation failed", { status: studentsRes.status });
    return apiError(
      "Instructor dashboard data is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  const body = await studentsRes.json().catch(() => null);
  const rosterItems = body?.ok && Array.isArray(body?.data?.items) ? body.data.items : null;
  const studentsTotal = body?.ok && Number.isInteger(body?.data?.total) ? body.data.total : null;
  if (!rosterItems || studentsTotal === null) {
    console.error("Instructor home roster aggregation returned an invalid response");
    return apiError(
      "Instructor dashboard data is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  return apiSuccess({
    queue: { count: queueCount, inReviewCount, preview: items.slice(0, 5) },
    atRisk: { count: rosterItems.length, items: rosterItems.slice(0, 5) },
    studentsTotal,
  });
}
