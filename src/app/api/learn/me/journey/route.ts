/**
 * GET /api/learn/me/journey?courseId=...
 *
 * Returns the learner's journey map for a course: the JourneyPlan +
 * all 30 JourneySteps with their statuses (pending / active / completed).
 * Used by the JourneyPanel to render the 30-topic map.
 *
 * Returns:
 *   {
 *     plan: { id, currentStep, totalSteps, status },
 *     steps: [{ id, stepOrder, stepType, title, description, status, completedAt, metadata }],
 *     currentTopic: { week, day } | null
 *   }
 *
 * Auto-creates the plan on first call (idempotent with /enroll).
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { WEEKLY_TOPICS } from "@/modules/course/lib/course-topics";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiNotFound("Course not found");

  await getOrCreateProfile(user.sub, courseId);

  // Get-or-create the journey plan (idempotent).
  let plan = await db.journeyPlan.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!plan) {
    const steps = WEEKLY_TOPICS.flatMap((w) =>
      w.topics.map((t, idx) => ({
        stepOrder: (w.week - 1) * 5 + idx,
        stepType: "slide" as const,
        title: `Week ${w.week} Day ${idx + 1}: ${t.title}`,
        description: t.objective,
        status: "pending" as const,
        xpReward: 5,
        metadata: { week: w.week, day: idx + 1 } as unknown as Prisma.InputJsonValue,
      })),
    );
    plan = await db.journeyPlan.create({
      data: {
        userId: user.sub,
        courseId,
        status: "active",
        totalSteps: steps.length,
        currentStep: 0,
        steps: { create: steps },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    // Mark first step active.
    if (plan.steps[0]) {
      await db.journeyStep.update({
        where: { id: plan.steps[0].id },
        data: { status: "active" },
      });
      plan.steps[0].status = "active";
    }
  }

  const today = await getTodayTopic(user.sub, courseId);
  const currentTopic = today ? { week: today.topic.week, day: today.topic.day } : null;

  // Mark each step's status against the masteryMap history so the
  // journey map renders the right state even if JourneyStep.status is stale.
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
  });
  const masteryMap = (profile?.masteryMap ?? {}) as Record<string, unknown>;
  const topicProgress = masteryMap.topicProgress as { history?: { week: number; day: number }[] } | undefined;
  const history: { week: number; day: number }[] = topicProgress?.history ?? [];
  const isHistory = (w: number, d: number) => history.some((h) => h.week === w && h.day === d);

  const steps = plan.steps.map((s) => {
    const meta = s.metadata as { week: number; day: number } | null;
    let status = s.status;
    if (meta && isHistory(meta.week, meta.day)) status = "completed";
    if (currentTopic && meta && meta.week === currentTopic.week && meta.day === currentTopic.day) {
      status = "active";
    }
    return {
      id: s.id,
      stepOrder: s.stepOrder,
      stepType: s.stepType,
      title: s.title,
      description: s.description,
      status,
      completedAt: s.completedAt,
      metadata: meta,
    };
  });

  return apiSuccess({
    plan: {
      id: plan.id,
      currentStep: plan.currentStep,
      totalSteps: plan.totalSteps,
      status: plan.status,
    },
    steps,
    currentTopic,
  });
}
