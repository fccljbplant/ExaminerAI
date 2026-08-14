/**
 * POST /api/v2/submissions/[id]/grade — I4 rubric grading (REDESIGN-P3 §I4, W4 review side)
 *
 * Writes a GradeEntry snapshot + updates the submission score/status.
 * Human entries always beat AI drafts (rubric engine). Audited via the
 * GradeEntry history — every cycle is one row.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { GradeSchema } from "@/modules/submission/contracts";
import { gradeSubmission } from "@/modules/submission/lib/submission-db";
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

  const demoBlock = await demoWriteBlock("grading a submission");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid grade body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const result = await gradeSubmission(id, user.sub, user.role, parsed.data.entries);
    return apiSuccess(result);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
