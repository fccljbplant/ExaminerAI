/**
 * PATCH /api/v2/exams/[id]/answer — L9 autosave + grade one answer
 * (REDESIGN-P4 §2 L9, W5)
 *
 * Debounce-friendly: re-saving the same index is idempotent. Grades via
 * gradeOneQuestion (AI + fallback), stores the record, and advances the
 * runner pointer (never backwards — resume-safe). Never cached.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { ExamAnswerInputSchema } from "@/modules/assessment/contracts";
import { saveExamAnswer } from "@/modules/assessment/lib/exam-session-db";
import { isExamsEnabled } from "@/modules/assessment/lib/exam-flag";
import { examErrorResponse } from "@/modules/assessment/lib/http";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function PATCH(
  req: NextRequest,
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

  const demoBlock = await demoWriteBlock("saving an exam answer");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = ExamAnswerInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid answer body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const result = await saveExamAnswer(user.sub, id, parsed.data, user.name);
    return apiSuccess(result);
  } catch (err) {
    return examErrorResponse(err);
  }
}
