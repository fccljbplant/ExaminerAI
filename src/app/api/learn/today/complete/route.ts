/**
 * POST /api/learn/today/complete?courseId=...
 *
 * Marks the current topic complete, advances to the next topic, and
 * awards XP. Returns the next topic key (or signals course completion).
 *
 * Returns:
 *   {
 *     completedTopic: { week, day },
 *     nextTopic: { week, day } | null,
 *     xpAwarded: number,        // 15 normally, +500 if course finished
 *     courseCompleted: boolean
 *   }
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import {
  getTodayTopic,
  markResourcesShown,
  completeTopicAndAdvance,
} from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  await getOrCreateProfile(user.sub, courseId);
  const today = await getTodayTopic(user.sub, courseId);
  if (!today) return apiError("Course is already complete", "NOT_FOUND", 404);

  // Mark resources as shown (idempotent).
  await markResourcesShown(user.sub, courseId);

  const completedTopic = { week: today.topic.week, day: today.topic.day };
  const { xpAwarded, nextTopic, courseCompleted } = await completeTopicAndAdvance(user.sub, courseId);

  // Advance the JourneyPlan's currentStep pointer.
  if (!courseCompleted) {
    await db.journeyPlan.updateMany({
      where: { userId: user.sub, courseId, status: "active" },
      data: { currentStep: { increment: 1 } },
    });
  }

  return apiSuccess({
    completedTopic,
    nextTopic,
    xpAwarded,
    courseCompleted,
  });
}
