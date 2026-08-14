/**
 * GET /api/v2/exams/[id]/results — L10 results review (REDESIGN-P4 §2 L10, W5)
 *
 * Full per-question review: score ring data, pass state, your answer /
 * correct answer / explanation per question. Works for both statuses
 * (in-progress sessions render the runner from the same view).
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getExamView } from "@/modules/assessment/lib/exam-session-db";
import { isExamsEnabled } from "@/modules/assessment/lib/exam-flag";
import { examErrorResponse } from "@/modules/assessment/lib/http";

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
  if (!(await isExamsEnabled())) {
    return apiError("Exams are not enabled yet", "FORBIDDEN", 403);
  }

  const { id } = await params;

  try {
    const view = await getExamView(user.sub, id);
    return apiSuccess(view);
  } catch (err) {
    return examErrorResponse(err);
  }
}
