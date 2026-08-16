/**
 * POST /api/v2/projects/[id]/approve — instructor approval gate (v2
 * project flow). Task generation stays locked until an instructor of the
 * course approves the proposal.
 *
 * Body: { decision: "approve" | "reject", note?: string }
 *
 * IDOR: the caller must be an instructor/org_admin AND teach the course
 * the project belongs to.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, apiValidationError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { isPortalEnabled } from "@/lib/feature-flags";

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
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("reviewing a project proposal");
  if (demoBlock) return demoBlock;

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const { decision, note } = body as { decision?: string; note?: string };
  if (decision !== "approve" && decision !== "reject") {
    return apiValidationError({ decision: "decision must be 'approve' or 'reject'" });
  }

  const project = await db.learnProject.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);
  if (!project.courseId) return apiError("Project is not linked to a course", "CONFLICT", 409);

  // IDOR: caller teaches the project's course.
  const teaching = await db.courseEnrollment.findFirst({
    where: { userId: user.sub, role: "instructor", courseId: project.courseId },
  });
  if (!teaching && user.role !== "org_admin") {
    return apiError("You do not teach this project's course", "FORBIDDEN", 403);
  }

  const status = decision === "approve" ? "approved" : "rejected";
  const updated = await db.learnProject.update({
    where: { id: project.id },
    data: {
      status,
      approvalNote: note ? String(note).trim().slice(0, 500) : null,
      approvedById: user.sub,
      approvedAt: new Date(),
    },
  });

  await db.notification.create({
    data: {
      userId: project.userId,
      type: decision === "approve" ? "project_approved" : "project_rejected",
      title:
        decision === "approve"
          ? "Project approved 🎉"
          : "Project needs changes",
      body:
        decision === "approve"
          ? `"${project.title}" was approved — you can now generate your task timeline.`
          : `"${project.title}" was sent back${note ? `: ${note.trim().slice(0, 300)}` : "."} Edit the proposal and resubmit.`,
      link: `/learner/projects/${project.id}`,
    },
  });

  return apiSuccess({
    project: {
      id: updated.id,
      status: updated.status,
      approvalNote: updated.approvalNote,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      learnerName: project.user.name,
    },
  });
}
