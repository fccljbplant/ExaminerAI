/**
 * GET /api/v2/assignments/[id] — L6 submission flow detail (REDESIGN-P3 §L6, W4)
 *
 * Instructions, required part types, rubric summary, resubmission policy,
 * and the learner's own submission (parts + status) for the submission
 * stepper. IDOR-guarded: only enrolled learners reach their own data.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getAssignmentDetail } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Assignments are not enabled yet", "FORBIDDEN", 403);
  }

  const { id } = await params;

  try {
    const detail = await getAssignmentDetail(id, user.sub);
    return apiSuccess(detail);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
