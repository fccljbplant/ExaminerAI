/**
 * GET /api/learn/today?courseId=...
 *
 * Returns today's topic data — what the learner is studying right now.
 * Includes the topic metadata, slide progress, prev/next topic keys,
 * and the AI-generated slide content (if any slides have been generated
 * already for this topic).
 *
 * Returns:
 *   {
 *     topic: TopicContext,
 *     slidesViewed, totalSlides, completed, resourcesShown,
 *     nextTopic, prevTopic, isLastTopicInCourse,
 *     slides: SlideData[]    // already-generated slides for this topic
 *   }
 *
 * Auto-enrolls on first visit so the page never renders empty.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import {
  getTodayTopic,
  getTopicByWeekDay,
} from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { updateStreak } from "@/modules/learn/lib/learner-profile";
import type { SlideData } from "@/modules/learn/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return apiError("Course not found", "NOT_FOUND", 404);

  await getOrCreateProfile(user.sub, courseId);
  // Mark today's activity for the streak counter.
  await updateStreak(user.sub, courseId);

  let today = await getTodayTopic(user.sub, courseId);
  if (!today) {
    return apiSuccess({
      topic: null,
      slidesViewed: 0,
      totalSlides: 4,
      completed: false,
      resourcesShown: false,
      nextTopic: null,
      prevTopic: null,
      isLastTopicInCourse: false,
      slides: [],
      courseCompleted: true,
    });
  }

  // Load any slides already generated for this topic.
  // We use LearnSlide.moduleId to encode the topic as "{week}-{day}".
  const topicKey = `${today.topic.week}-${today.topic.day}`;
  const slideRows = await db.learnSlide.findMany({
    where: { courseId, moduleId: topicKey },
    orderBy: { slideOrder: "asc" },
  });
  const topicSlides = slideRows
    .slice(0, 4)
    .map<SlideData>((s) => ({
      title: s.title,
      bullets: s.bullets as string[],
      visualSpec: s.visualSpec ?? undefined,
      keyTerms: s.keyTerms as string[],
      checkQuestion: s.checkQuestion ?? undefined,
      realWorldExample: s.realWorldExample ?? undefined,
      analogy: s.analogy ?? undefined,
    }));

  return apiSuccess({
    ...today,
    slides: topicSlides,
    courseCompleted: false,
  });
}
