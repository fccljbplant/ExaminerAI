/**
 * POST /api/v2/submissions/[id]/ai-draft — I4 AI draft (aiAssist criteria only)
 * (REDESIGN-P4 §5, P2 §3.4)
 *
 * Drafts scores/notes for aiAssist rubric criteria from the text-only
 * packet. Every entry is labeled machine-generated (aiDraft: true) and
 * the human entry always wins upstream. Degrades to empty on AI failure
 * — review proceeds human-only.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";
import { getSubmissionForReview } from "@/modules/submission/lib/submission-db";
import { draftAiGrades } from "@/modules/submission/lib/ai-draft";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { submissionErrorResponse } from "@/modules/submission/lib/http";
import type { RubricCriterionDef } from "@/modules/submission/lib/rubric-engine";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function POST(
  _req: NextRequest,
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

  const demoBlock = await demoWriteBlock("generating an AI draft");
  if (demoBlock) return demoBlock;

  try {
    // The review bundle carries the rubric + parts + summary (IDOR-guarded).
    const bundle = await getSubmissionForReview(id, user.sub);
    if (!bundle.rubric || bundle.rubric.criteria.length === 0) {
      return apiError("This assignment has no rubric to draft against", "CONFLICT", 409);
    }

    const result = await draftAiGrades({
      userId: user.sub,
      assignmentTitle: bundle.assignment.title,
      learnerSummary: bundle.learnerSummary,
      parts: bundle.parts,
      criteria: bundle.rubric.criteria as RubricCriterionDef[],
    });

    if (!result.generated) {
      logger.info("ai-draft returned no entries", { submissionId: id, userId: user.sub });
    }

    return apiSuccess({
      entries: result.entries,
      generated: result.generated,
      // UI label contract (P3 I4): drafts are never presented as human.
      label: "machine draft — verify",
    });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
