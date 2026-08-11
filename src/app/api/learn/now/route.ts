/**
 * GET /api/learn/now?courseId=...
 *
 * Returns the learner's "next action" snapshot for the top-of-shell
 * status strip and the NOW card on the Project panel.
 *
 * Returns:
 *   {
 *     nextStep: { label, kind },                 // "Continue: Week 2 Day 3"
 *     profile: { totalXP, learnerLevel, streakCurrent },
 *     dailyTest: { status },                     // "in_progress" | "completed" | "none"
 *     project: { id, title, activeMilestone } | null
 *   }
 *
 * Auto-enrolls the user on first visit (idempotent) so the page never
 * shows an empty state without a CTA.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getLearnerLevel } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  // Verify the course exists.
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiError("Course not found", "NOT_FOUND", 404);

  // Auto-enroll on first visit.
  const profile = await getOrCreateProfile(user.sub, courseId);
  let today = await getTodayTopic(user.sub, courseId);
  if (!today) {
    // Defensive: should never happen after getOrCreateProfile, but if the
    // masteryMap is corrupt, re-initialize it.
    await db.learnProfile.update({
      where: { id: profile.id },
      data: {
        masteryMap: {
          topicProgress: {
            current: { week: 1, day: 1 },
            history: [],
            slidesViewed: 0,
            resourcesShown: false,
          },
        } as any,
      },
    });
    today = await getTodayTopic(user.sub, courseId);
  }

  // Daily test status (today only).
  const todayKey = new Date();
  todayKey.setHours(0, 0, 0, 0);
  const dailyTest = await db.learnDailyTest.findUnique({
    where: { userId_courseId_date: { userId: user.sub, courseId, date: todayKey } },
    select: { status: true },
  });

  // Active project + first non-completed milestone.
  const project = await db.learnProject.findFirst({
    where: { userId: user.sub, courseId, status: "active" },
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
  });
  const activeMilestone = project?.milestones.find((m) => m.status !== "completed") ?? null;

  const level = getLearnerLevel(profile.totalXP);

  return apiSuccess({
    nextStep: today
      ? {
          label: `Continue: Week ${today.topic.week} Day ${today.topic.day} — ${today.topic.title}`,
          kind: today.completed ? "review" : "learn",
          week: today.topic.week,
          day: today.topic.day,
          slidesViewed: today.slidesViewed,
          totalSlides: today.totalSlides,
        }
      : { label: "Course complete", kind: "done", week: null, day: null, slidesViewed: 0, totalSlides: 0 },
    profile: {
      totalXP: profile.totalXP,
      learnerLevel: level.name,
      streakCurrent: profile.streakCurrent,
    },
    dailyTest: dailyTest
      ? { status: dailyTest.status }
      : { status: "none" },
    project: project
      ? {
          id: project.id,
          title: project.title,
          activeMilestone: activeMilestone
            ? { id: activeMilestone.id, title: activeMilestone.title, description: activeMilestone.description, order: activeMilestone.order }
            : null,
        }
      : null,
  });
}
