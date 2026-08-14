/**
 * POST /api/v2/exams/[id]/complete — L9 finish → L10 results
 * (REDESIGN-P4 §2 L9/L10, W5)
 *
 * Guards: in-progress only, all questions answered. Computes the score
 * (unanswered = 0), awards XP (daily 30 / weekly 100), fires the
 * test_result notification, marks completed, returns the results view.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { completeExam } from "@/modules/assessment/lib/exam-session-db";
import { isExamsEnabled } from "@/modules/assessment/lib/exam-flag";
import { examErrorResponse } from "@/modules/assessment/lib/http";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function POST(
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

  const demoBlock = await demoWriteBlock("completing an exam");
  if (demoBlock) return demoBlock;

  try {
    const view = await completeExam(user.sub, id);
    return apiSuccess(view);
  } catch (err) {
    return examErrorResponse(err);
  }
}
