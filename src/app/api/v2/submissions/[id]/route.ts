/**
 * GET /api/v2/submissions/[id] — I4 review detail (REDESIGN-P3 §I4, W4 review side)
 *
 * Full review bundle for one submission: parts (with extractedText),
 * rubric + policy, feedback thread, sign-off chain, grade history.
 * Instructor-scoped + IDOR-guarded in the service layer.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getSubmissionForReview } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Submissions are not enabled yet", "FORBIDDEN", 403);
  }

  const { id } = await params;

  try {
    const bundle = await getSubmissionForReview(id, user.sub);
    return apiSuccess(bundle);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
