/**
 * POST /api/v2/exams/[id]/start — L9 exam runner start/resume
 * (REDESIGN-P4 §2 L9, W5)
 *
 * [id] is the exam slug (daily-<courseId>-<YYYY-MM-DD> |
 * weekly-<courseId>-<week>). Idempotent: starting an existing session
 * returns its current state (questions + answers) so the runner resumes.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { parseExamSlug } from "@/modules/assessment/contracts";
import { getOrStartExam, ExamError } from "@/modules/assessment/lib/exam-session-db";
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
  const parsed = parseExamSlug(id);
  if (!parsed) return apiError("Invalid exam id", "VALIDATION_ERROR", 400);

  const demoBlock = await demoWriteBlock("starting an exam");
  if (demoBlock) return demoBlock;

  try {
    const view = await getOrStartExam(
      user.sub,
      parsed.kind,
      parsed.courseId,
      parsed.date,
      parsed.week,
    );
    return apiSuccess(view);
  } catch (err) {
    return examErrorResponse(err);
  }
}
