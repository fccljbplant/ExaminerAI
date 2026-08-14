/**
 * POST /api/v2/submissions/[id]/feedback — L7 learner ↔ mentor thread
 * (REDESIGN-P3 §L7/I4, W4 review side)
 *
 * Learners post text updates into their own submission thread (the
 * "Send update to mentor" action); instructors post review notes into
 * the same thread. The service checks the author's right server-side:
 * owner (learner) or course instructor (IDOR guard).
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

// Both roles may post: the owning learner, or an instructor of the course.
// The service decides which (and notifies the other side).
const FEEDBACK_ROLES = new Set(["learner", "student", "instructor", "org_admin"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!FEEDBACK_ROLES.has(user.role)) {
    return apiError("Unauthorized to post feedback", "FORBIDDEN", 403);
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
    // Pass the real role — the service routes learner vs instructor
    // authoring (instructor messages notify the learner).
    const { messageId } = await postFeedback(
      id,
      { id: user.sub, name: user.name, role: user.role },
      parsed.data,
    );
    return apiSuccess({ messageId });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
