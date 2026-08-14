/**
 * GET /api/v2/courses/[id]/overview — L3 Course detail, overview tab
 * (REDESIGN-P3 §L3)
 *
 * Course meta with parsed JSON fields plus the caller's own enrollment
 * summary. Not-enrolled callers still see the marketing view.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";

export const runtime = "nodejs";

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { id } = await params;
  const course = await db.course.findFirst({
    where: {
      id,
      isActive: true,
      OR: [{ published: true }, { isDefault: true }],
    },
    select: {
      id: true,
      name: true,
      subtitle: true,
      description: true,
      category: true,
      level: true,
      durationWeeks: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      thumbnailUrl: true,
      skillsVerified: true,
      whatYouWillLearn: true,
      prerequisites: true,
      toolsUsed: true,
      instructorName: true,
    },
  });
  if (!course) return apiNotFound();

  const weekCount = await db.courseWeek.count({ where: { courseId: id } });

  // Caller's own state for this course (drives enrolled CTA vs enroll CTA).
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId: id } },
    select: { totalXP: true, streakCurrent: true, masteryMap: true },
  });

  let position: { week: number; day: number } | null = null;
  let nextLesson: string | null = null;
  if (profile) {
    const today = await getTodayTopic(user.sub, id);
    if (today) {
      position = { week: today.topic.week, day: today.topic.day };
      nextLesson = `Week ${today.topic.week} · Day ${today.topic.day} — ${today.topic.title}`;
    }
  }

  return apiSuccess({
    course: {
      ...course,
      skillsVerified: parseJsonArray(course.skillsVerified),
      whatYouWillLearn: parseJsonArray(course.whatYouWillLearn),
      prerequisites: parseJsonArray(course.prerequisites),
      toolsUsed: parseJsonArray(course.toolsUsed),
      weekCount,
    },
    enrollment: profile
      ? {
          enrolled: true,
          totalXP: profile.totalXP,
          streakCurrent: profile.streakCurrent,
          position,
          nextLesson,
        }
      : { enrolled: false },
  });
}
