/**
 * POST /api/v2/org/compliance/nudge — nudge an expired learner (B2B ops)
 *
 * Body: { userId, courseId }. Verifies the user is one of the org's
 * members and has a student enrollment in the course, then creates an
 * in-app Notification ("Training due", link /learn/<courseId>).
 * Audited ("org_compliance_nudged").
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/email";
import { getOrgContext } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const NudgeBody = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("nudging a learner");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = NudgeBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid nudge body", "VALIDATION_ERROR", 400);
  }

  try {
    const membership = await db.orgMember.findFirst({
      where: {
        orgId: ctx.orgId,
        userId: parsed.data.userId,
        status: { not: "removed" },
      },
      select: { userId: true },
    });
    if (!membership) {
      return apiError("That user is not a member of your organization", "NOT_FOUND", 404);
    }

    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId: parsed.data.userId, courseId: parsed.data.courseId, role: "student" },
      select: { course: { select: { name: true } } },
    });
    if (!enrollment) {
      return apiError("That user is not enrolled in this course", "NOT_FOUND", 404);
    }

    await sendNotification({
      userId: parsed.data.userId,
      type: "message_received",
      title: "Training due",
      body: `Your training for ${enrollment.course.name} is due. Please complete or retake it to stay compliant.`,
      link: `/learn/${parsed.data.courseId}`,
    });

    await logAudit({
      actor: { id: user.sub, name: user.name, role: user.role },
      action: "org_compliance_nudged",
      target: { type: "user", id: parsed.data.userId },
      metadata: { courseId: parsed.data.courseId, courseName: enrollment.course.name },
      req,
    }).catch(() => {});

    return apiSuccess({ nudged: true });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
