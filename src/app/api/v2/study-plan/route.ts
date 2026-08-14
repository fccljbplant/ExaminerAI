/**
 * GET  /api/v2/study-plan — L12 study plan (REDESIGN-P4, W3)
 * POST /api/v2/study-plan — choose a scenario option
 *
 * v2 envelope: { ok, data } / { ok: false, error, code }
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiUnauthorized,
  apiError,
  apiNotFound,
  apiServerError,
} from "@/lib/api-response";
import { StudyPlanQuery, ChoosePlanSchema } from "@/modules/learn/contracts";
import { getStudyPlan, getStudyScenario } from "@/modules/learn/lib/study-flow-db";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

/** Resolve the courseId the plan should be built for. When the client
 *  omits it (first L12 load), fall back to the learner's most recently
 *  active enrollment so the page works with a single round trip. */
async function resolveCourse(
  userId: string,
  courseId?: string,
): Promise<{ courseId: string; courseName: string | null } | null> {
  if (courseId) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { name: true },
    });
    return course ? { courseId, courseName: course.name } : null;
  }
  const primary = await db.learnProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { courseId: true, course: { select: { name: true } } },
  });
  return primary
    ? { courseId: primary.courseId, courseName: primary.course.name }
    : null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const parsed = StudyPlanQuery.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return apiError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const course = await resolveCourse(user.sub, parsed.data.courseId);
    if (!course) return apiNotFound("No active enrollment — join a course first");

    // Scenario first so its suggested budget can preselect the plan window
    // when the learner has not picked one explicitly.
    const scenario = await getStudyScenario(user.sub, course.courseId);
    const budgetMin = parsed.data.budgetMin ?? scenario.budget ?? 30;

    const items = await getStudyPlan(user.sub, course.courseId, budgetMin);
    const totalMin = items.reduce((s, p) => s + p.estMin, 0);

    return apiSuccess({
      courseId: course.courseId,
      courseName: course.courseName,
      items,
      totalMin,
      budgetMin,
      scenario,
    });
  } catch (err) {
    return apiServerError(
      err instanceof Error ? err.message : "Failed to generate study plan",
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = ChoosePlanSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { courseId, scenario, budgetMin } = parsed.data;

  // Record the choice as an EngagementEvent.
  await db.engagementEvent.create({
    data: {
      userId: user.sub,
      courseId,
      eventType: "plan.chose",
      metadata: { scenario, budgetMin } as unknown as Prisma.InputJsonValue,
    },
  });

  // Generate the plan with scenario-specific budget adjustments.
  let adjustedBudget = budgetMin ?? 30;
  if (scenario === "condensed" || scenario === "quick_review" || scenario === "micro_lesson" || scenario === "quick_quiz") {
    adjustedBudget = Math.min(adjustedBudget, 15);
  } else if (scenario === "emergency_plan") {
    adjustedBudget = Math.max(adjustedBudget, 60);
  }

  try {
    const items = await getStudyPlan(user.sub, courseId, adjustedBudget);
    const totalMin = items.reduce((s, p) => s + p.estMin, 0);

    return apiSuccess({
      scenario,
      items,
      totalMin,
      budgetMin: adjustedBudget,
    });
  } catch (err) {
    return apiServerError(
      err instanceof Error ? err.message : "Failed to generate study plan",
    );
  }
}
