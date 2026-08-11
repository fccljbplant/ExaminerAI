/**
 * GET /api/learn/resources?slideId=...&courseId=...
 *
 * Returns the curated resources for a slide's topic. If `slideId` is
 * provided, looks up the slide's topic (via LearnSlide.moduleId =
 * "{week}-{day}") and returns the matching WEEKLY_TOPICS resources.
 * If only `courseId` is provided, returns the resources for the user's
 * current topic.
 *
 * Returns: { resources: [{ label, url }], topic: { week, day, title, objective } }
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getTodayTopic, getTopicByWeekDay } from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { getWeekPhase } from "@/modules/course/lib/course-topics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const slideId = url.searchParams.get("slideId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiNotFound("Course not found");

  await getOrCreateProfile(user.sub, courseId);

  let week: number | null = null;
  let day: number | null = null;

  if (slideId) {
    const slide = await db.learnSlide.findUnique({ where: { id: slideId } });
    if (slide && slide.moduleId) {
      const [w, d] = slide.moduleId.split("-");
      week = Number(w);
      day = Number(d);
    }
  } else {
    // Default to current topic.
    const today = await getTodayTopic(user.sub, courseId);
    if (today) {
      week = today.topic.week;
      day = today.topic.day;
    }
  }

  if (week == null || day == null) {
    return apiSuccess({ resources: [], topic: null });
  }

  const topic = getTopicByWeekDay(week, day);
  if (!topic) return apiSuccess({ resources: [], topic: null });

  return apiSuccess({
    resources: topic.resources ?? [],
    topic: {
      week,
      day,
      title: topic.title,
      objective: topic.objective,
      phase: getWeekPhase(week),
    },
  });
}
