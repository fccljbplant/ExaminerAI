/**
 * GET/POST/PATCH/DELETE /api/v2/instructor/assignments — canonical
 * instructor assignment management (Assignment/GroupTask reconciliation,
 * COMBINED-AUDIT fixation 2).
 *
 * New instructor-created assignments land in the canonical `Assignment`
 * store, which the learner L5/L6 surfaces and the review queue already
 * read — one end-to-end creation → submission → review flow. Legacy
 * `GroupTask` rows are reconciled into the GET list through the verified
 * read-time mapping (provenance-badged in the UI); no backfill, no
 * schema change.
 *
 * Access: instructor/org admin/platform admin; the service layer scopes
 * everything to courses the caller teaches (same guard as the review
 * queue). Writes are blocked for demo accounts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import {
  createInstructorAssignment,
  deleteAssignmentIfClean,
  listInstructorAssignments,
  setAssignmentStatus,
} from "@/modules/submission/lib/submission-db";
import { submissionErrorResponse } from "@/modules/submission/lib/http";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["instructor", "org_admin", "platform_admin"]);

/** GET ?courseId=… — reconciled list (canonical + legacy-mapped). */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!MANAGE_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return apiError("courseId is required", "VALIDATION_ERROR", 400);
  }
  try {
    const items = await listInstructorAssignments(user.sub, courseId);
    return apiSuccess({ items });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}

/** POST — create a published assignment in the canonical store. */
export async function POST(req: NextRequest) {
  const demoBlock = await demoWriteBlock("managing assignments");
  if (demoBlock) return demoBlock;
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!MANAGE_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  const body = await req.json().catch(() => ({}));
  const { courseId, title, description, dueDate, week, maxScore } = body as {
    courseId?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    week?: number;
    maxScore?: number;
  };
  if (!courseId || !title?.trim()) {
    return apiError("courseId and title are required", "VALIDATION_ERROR", 400);
  }
  if (week !== undefined && week !== null && (!Number.isInteger(week) || week < 1 || week > 52)) {
    return apiError("week must be an integer 1–52", "VALIDATION_ERROR", 400);
  }
  if (maxScore !== undefined && maxScore !== null && (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 10000)) {
    return apiError("maxScore must be an integer 1–10000", "VALIDATION_ERROR", 400);
  }
  try {
    const item = await createInstructorAssignment(user.sub, {
      courseId,
      title,
      description,
      dueDate: dueDate || null,
      week: week ?? null,
      maxScore: maxScore ?? null,
    });
    return apiSuccess({ item }, 201);
  } catch (err) {
    return submissionErrorResponse(err);
  }
}

/** PATCH — publish/archive. Body: { assignmentId, status }. */
export async function PATCH(req: NextRequest) {
  const demoBlock = await demoWriteBlock("managing assignments");
  if (demoBlock) return demoBlock;
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!MANAGE_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  const body = await req.json().catch(() => ({}));
  const { assignmentId, status } = body as { assignmentId?: string; status?: string };
  if (!assignmentId || (status !== "published" && status !== "archived")) {
    return apiError("assignmentId and status (published|archived) are required", "VALIDATION_ERROR", 400);
  }
  try {
    const item = await setAssignmentStatus(user.sub, assignmentId, status);
    return apiSuccess({ item });
  } catch (err) {
    return submissionErrorResponse(err);
  }
}

/**
 * DELETE — only assignments without submissions (learner work must be
 * archived, never silently cascade-deleted). Body: { assignmentId }.
 */
export async function DELETE(req: NextRequest) {
  const demoBlock = await demoWriteBlock("managing assignments");
  if (demoBlock) return demoBlock;
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!MANAGE_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  const body = await req.json().catch(() => ({}));
  const { assignmentId } = body as { assignmentId?: string };
  if (!assignmentId) {
    return apiError("assignmentId is required", "VALIDATION_ERROR", 400);
  }
  try {
    return apiSuccess(await deleteAssignmentIfClean(user.sub, assignmentId));
  } catch (err) {
    return submissionErrorResponse(err);
  }
}
