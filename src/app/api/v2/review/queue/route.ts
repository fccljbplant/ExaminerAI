/**
 * GET /api/v2/review/queue — I3 Review queue (REDESIGN-P3 §I3, W4 review side)
 *
 * Instructor's submission queue scoped to courses they teach (IDOR guard
 * in the service layer). Filters: type (part type), status, courseId;
 * cursor paginated. Gated by the submissions_v2 portal flag.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { ReviewQueueQuery } from "@/modules/submission/contracts";
import { reviewQueue } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Submissions are not enabled yet", "FORBIDDEN", 403);
  }

  const parsed = ReviewQueueQuery.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return apiError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const { items, nextCursor } = await reviewQueue(user.sub, {
      type: parsed.data.type,
      status: parsed.data.status,
      courseId: parsed.data.courseId,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
    return apiSuccess({ items, nextCursor });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
