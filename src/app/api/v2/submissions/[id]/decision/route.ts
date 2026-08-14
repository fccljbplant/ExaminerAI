/**
 * POST /api/v2/submissions/[id]/decision — I4 decision bar
 * (REDESIGN-P3 §I4, W4 review side)
 *
 * approve | request_changes (feedback required) | signoff (ordered chain).
 * Records SignOff rows, auto-posts request-changes feedback into the
 * thread, notifies the learner. Status transitions per lifecycle.ts.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { DecisionSchema } from "@/modules/submission/contracts";
import { decideSubmission } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function POST(
  req: NextRequest,
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

  const demoBlock = await demoWriteBlock("deciding on a submission");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid decision body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const result = await decideSubmission(
      id,
      { id: user.sub, name: user.name, role: user.role },
      parsed.data,
    );
    return apiSuccess(result);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
