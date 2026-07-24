import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getJourneySteps,
  getProjectTemplate,
  getAIPrompts,
  getTestConfig,
  getReportCardTemplate,
  getCourseInfo,
} from "@/lib/course-config";

/** GET /api/course/config — returns ALL course-specific configs for the current
 *  student in a single call. The client-side Journey wizard + other components
 *  use this to adapt to the student's assigned course.
 *
 *  Returns:
 *  - courseId, courseName
 *  - journeySteps: array of step configs (or default)
 *  - projectTemplate: { durationWeeks, capstoneIdeas }
 *  - aiPrompts: { system prompts } (or default)
 *  - testConfig: { totalQuestions, maxReplies, pillars, minScore }
 *  - reportCardTemplate: { gradingScale, weights, sections }
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [courseInfo, journeySteps, projectTemplate, aiPrompts, testConfig, reportCardTemplate] = await Promise.all([
    getCourseInfo(user.id),
    getJourneySteps(user.id),
    getProjectTemplate(user.id),
    getAIPrompts(user.id),
    getTestConfig(user.id),
    getReportCardTemplate(user.id),
  ]);

  return NextResponse.json({
    courseId: courseInfo.courseId,
    courseName: courseInfo.courseName,
    journeySteps,
    projectTemplate,
    aiPrompts,
    testConfig,
    reportCardTemplate,
  });
}
