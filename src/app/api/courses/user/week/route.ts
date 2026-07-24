import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCourseWeekTopicTitles,
  getCourseWeekPhase,
  getCourseDurationWeeks,
} from "@/lib/course-db";
import { getBootcampDayNumber } from "@/lib/course-topics";

/** GET /api/courses/user/week?week=N
 *
 *  Returns the topic titles, phase, and final-week flag for the
 *  requesting user's specific week. Used by client components
 *  (e.g. StudentDashboard QuestionPanel) that need to render
 *  course-aligned topic lists without importing the sync helpers
 *  from course-topics.ts (which are hardcoded to the default 6-week
 *  bootcamp and don't reflect the user's assigned course).
 *
 *  Response:
 *    {
 *      week: number,
 *      topicTitles: string[],     // length = days per week (typically 5)
 *      phase: string,             // e.g. "Week 3: APIs & Integrations"
 *      totalWeeks: number,        // course duration (default 6 if no course assigned)
 *      isFinalWeek: boolean,
 *      todayDay: number,          // 1-5 based on day-of-week
 *      todayTopic: string | null  // topic for today (or first topic)
 *    }
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const week = weekParam ? Number(weekParam) : user.currentWeek;

  if (!Number.isInteger(week) || week < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  // Look up the user's course duration (defaults to 6 if no course assigned)
  const totalWeeks = await getCourseDurationWeeks(user.id);
  if (week > totalWeeks) {
    return NextResponse.json(
      { error: `Week ${week} is out of range. This course has ${totalWeeks} week(s).` },
      { status: 400 }
    );
  }

  // Fetch week topics + phase in parallel
  const [topicTitles, phase] = await Promise.all([
    getCourseWeekTopicTitles(user.id, week),
    getCourseWeekPhase(user.id, week),
  ]);

  const todayDay = getBootcampDayNumber(new Date());
  const todayTopic = topicTitles[todayDay - 1] ?? topicTitles[0] ?? null;

  return NextResponse.json({
    week,
    topicTitles,
    phase,
    totalWeeks,
    isFinalWeek: week === totalWeeks,
    todayDay,
    todayTopic,
  });
}
