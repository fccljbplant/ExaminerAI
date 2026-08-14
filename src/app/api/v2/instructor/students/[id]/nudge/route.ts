/**
 * POST /api/v2/instructor/students/[id]/nudge — I6 intervention
 * (REDESIGN-P3 §I6, W10 rebuild)
 *
 * One-tap academic nudge: posts a notification to the student
 * ("your instructor nudged you…"). Audited. Demo-guarded.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { isPortalEnabled } from "@/lib/feature-flags";

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
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("nudging a student");
  if (demoBlock) return demoBlock;

  const { id } = await params;

  // IDOR: must teach a course the student is enrolled in.
  const teaching = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "instructor" },
    select: { courseId: true },
  });
  const shared = teaching.length
    ? await db.courseEnrollment.findFirst({
        where: { userId: id, role: "student", courseId: { in: teaching.map((t) => t.courseId) } },
        select: { id: true },
      })
    : null;
  if (!shared) return apiError("You do not teach this student", "FORBIDDEN", 403);

  await db.notification.create({
    data: {
      userId: id,
      type: "mentor",
      title: "Your instructor reached out",
      body: `${user.name} checked in on your progress — keep going, you've got this.`,
      link: "/learner",
    },
  });

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "intervention_nudged",
    target: { type: "user", id },
  });

  return apiSuccess({ nudged: true });
}
