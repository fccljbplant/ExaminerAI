/**
 * POST /api/v2/assignments/[id]/submit — L6 submit (REDESIGN-P3 §L6, W4)
 *
 * Validates required part types + mandatory learnerSummary (lifecycle.ts),
 * then submits. Submitting a changes_requested submission follows the
 * resubmission rules (cycle + cooldown) automatically. Writes a
 * submit.sent EngagementEvent for study-flow analytics.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { SubmitSchema } from "@/modules/submission/contracts";
import { submitAssignment } from "@/modules/submission/lib/submission-db";
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

  const demoBlock = await demoWriteBlock("submitting work");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid submission body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const result = await submitAssignment(id, user.sub, {
      learnerSummary: parsed.data.learnerSummary,
      parts: parsed.data.parts,
    });
    return apiSuccess(result);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
