/**
 * POST /api/v2/submissions/[id]/feedback — L7 learner message to mentor
 * (REDESIGN-P3 §L7, W4)
 *
 * Learners post text updates into their own submission thread (the
 * "Send update to mentor" action). Instructor-authored feedback uses
 * the same service; ownership is checked server-side (IDOR guard).
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { FeedbackSchema } from "@/modules/submission/contracts";
import { postFeedback } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function POST(
  req: NextRequest,
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

  const demoBlock = await demoWriteBlock("posting a message");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid feedback body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const { messageId } = await postFeedback(
      id,
      { id: user.sub, name: user.name, role: "learner" },
      parsed.data,
    );
    return apiSuccess({ messageId });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
