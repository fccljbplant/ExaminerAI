/**
 * GET /api/v2/assignments — L5 Assignments list (REDESIGN-P3 §L5, W4)
 *
 * Cursor-paginated list of the learner's own assignments with a
 * submission rollup per row. Filters: status (due/in_review/returned/
 * graded/all), courseId. Gated by the submissions_v2 portal flag.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { AssignmentsQuery } from "@/modules/submission/contracts";
import { listLearnerAssignments } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Assignments are not enabled yet", "FORBIDDEN", 403);
  }

  const parsed = AssignmentsQuery.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return apiError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const { items, nextCursor } = await listLearnerAssignments(user.sub, {
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
