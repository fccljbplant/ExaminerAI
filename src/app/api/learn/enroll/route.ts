/**
 * POST /api/learn/enroll
 *
 * Body: { courseId }
 *
 * Creates the learner's Learn state for a course, atomically:
 *   1. LearnProfile (with empty masteryMap starting at W1D1)
 *   2. JourneyPlan + 30 JourneySteps (one per WEEKLY_TOPICS entry)
 *   3. LearnProject + 4 default milestones
 *
 * Idempotent: if the user is already enrolled, returns ok without
 * creating duplicates (the @@unique constraints enforce this).
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { WEEKLY_TOPICS } from "@/modules/course/lib/course-topics";
import { apiError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";

export const runtime = "nodejs";

const DEFAULT_PROJECT_MILESTONES = [
  { title: "Plan & design", description: "Define project goals, scope, and architecture.", order: 0 },
  { title: "Build core features", description: "Implement the minimum-viable version of the main feature set.", order: 1 },
  { title: "Integrate & test", description: "Wire everything together and run end-to-end tests.", order: 2 },
  { title: "Polish & ship", description: "Final UX polish, documentation, and deployment.", order: 3 },
];

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  let body: { courseId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine — we'll validate below */
  }
  const courseId = body?.courseId;
  if (!courseId) return apiValidationError({ courseId: "courseId is required" });

  // Verify the course exists.
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiError("Course not found", "NOT_FOUND", 404);

  // Idempotent: if LearnProfile already exists, return ok.
  const existing = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
  });
  if (existing) return apiSuccess({ ok: true, alreadyEnrolled: true, profileId: existing.id });

  // Build the 30 topic steps from WEEKLY_TOPICS.
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

  await db.$transaction(async (tx) => {
    // 1. LearnProfile
    await tx.learnProfile.create({
      data: {
        userId: user.sub,
        courseId,
        preferredLanguage: "en",
        teachingLevel: 4,
        totalXP: 0,
        learnerLevel: "Rookie",
        masteryMap: {
          topicProgress: {
            current: { week: 1, day: 1 },
            history: [],
            slidesViewed: 0,
            resourcesShown: false,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 2. JourneyPlan + 30 steps
    const journey = await tx.journeyPlan.create({
      data: {
        userId: user.sub,
        courseId,
        status: "active",
        totalSteps: steps.length,
        currentStep: 0,
        steps: { create: steps },
      },
    });

    // Mark the first step active.
    if (journey) {
      const firstStep = await tx.journeyStep.findFirst({
        where: { journeyId: journey.id },
        orderBy: { stepOrder: "asc" },
      });
      if (firstStep) {
        await tx.journeyStep.update({
          where: { id: firstStep.id },
          data: { status: "active" },
        });
      }
    }

    // 3. LearnProject + 4 default milestones
    await tx.learnProject.create({
      data: {
        userId: user.sub,
        courseId,
        title: `My ${course.name} Project`,
        goal: "Apply what I learn in this course to a real, shippable project.",
        status: "active",
        milestones: {
          create: DEFAULT_PROJECT_MILESTONES,
        },
      },
    });
  });

  return apiSuccess({ ok: true, alreadyEnrolled: false });
}
