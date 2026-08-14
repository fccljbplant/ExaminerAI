/**
 * GET /api/v2/srs/queue — L12 SRS review queue (REDESIGN-P4, W3)
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getSrsQueue } from "@/modules/learn/lib/study-flow-db";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const courseId = req.nextUrl.searchParams.get("courseId") ?? "";
  if (!courseId) {
    return apiError("courseId is required", "VALIDATION_ERROR", 400);
  }

  const queue = await getSrsQueue(user.sub, courseId);
  return apiSuccess({ cards: queue, count: queue.length });
}
