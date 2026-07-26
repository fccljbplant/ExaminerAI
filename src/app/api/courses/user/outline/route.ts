import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCourseTopics, getCourseDurationWeeks, getCourseMetadata, getCourseProjectConfig } from "@/lib/course-db";

/** GET /api/courses/user/outline
 *
 *  Returns the FULL course outline for the requesting user — all weeks,
 *  all days, with titles + objectives + whyItMatters + topicsCovered +
 *  activity + deliverable + resources. Used by the CourseOutline component
 *  to render the student's actual assigned course (replacing the old static
 *  course-plan.html iframe).
 *
 *  Falls back to the default 6-week web dev curriculum (WEEKLY_TOPICS in
 *  course-topics.ts) if the student has no course assigned.
 *
 *  Response:
 *    {
 *      courseName: string | null,
 *      courseDescription: string | null,
 *      totalWeeks: number,
 *      weeks: [{
 *        week: number,
 *        phase: string,
 *        days: [{
 *          day: number,
 *          title: string,
 *          objective: string,
 *          whyItMatters: string,
 *          topicsCovered: string[],
 *          activity: string,
 *          deliverable: string,
 *          resources: { label: string; url: string }[]
 *        }]
 *      }]
 *    }
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the full course outline + metadata + project config in parallel
  // M2-fix: fetch course once instead of 3 times
  const [weeks, courseMeta, projectConfig] = await Promise.all([
    getCourseTopics(user.id),
    getCourseMetadata(user.id),
    getCourseProjectConfig(user.id),
  ]);
  const totalWeeks = weeks.length;

  // Map to the response shape — parse JSON fields + flatten the DailyTopic
  // structure so the client doesn't have to deal with the raw DB shape.
  const mappedWeeks = weeks.map(w => ({
    week: w.week,
    phase: w.phase,
    days: w.topics.map((t, i) => {
      // The getCourseTopics helper returns topics with extra fields
      // (whyItMatters, topicsCovered, activity, deliverable) via type casting
      // when reading from the DB. Access them safely.
      const enriched = t as DailyTopic & {
        whyItMatters?: string;
        topicsCovered?: string[];
        activity?: string;
        deliverable?: string;
      };
      return {
        day: (t as any).day || i + 1,
        title: t.title,
        objective: t.objective || "",
        whyItMatters: enriched.whyItMatters || "",
        topicsCovered: Array.isArray(enriched.topicsCovered) ? enriched.topicsCovered : [],
        activity: enriched.activity || "",
        deliverable: enriched.deliverable || "",
        resources: Array.isArray(t.resources) ? t.resources : [],
      };
    }),
  }));

  return NextResponse.json({
    courseName: courseMeta?.name ?? null,
    courseDescription: courseMeta?.description ?? null,
    domain: courseMeta?.domain ?? null,
    level: courseMeta?.level ?? null,
    toolsUsed: courseMeta?.toolsUsed ?? [],
    deliverableTypes: courseMeta?.deliverableTypes ?? [],
    totalWeeks,
    weeks: mappedWeeks,
    // Project config — drives whether the student sees the Project nav, banners,
    // and what default duration the project-setup form pre-selects.
    project: {
      courseAssigned: projectConfig.courseAssigned,
      courseId: projectConfig.courseId,
      courseName: projectConfig.courseName,
      totalWeeks: projectConfig.totalWeeks,
      projectEnabled: projectConfig.projectEnabled,
      projectRequired: projectConfig.projectRequired,
      projectDefaultDurationWeeks: projectConfig.projectDefaultDurationWeeks,
      // Convenience: the max project duration the student can pick = courseWeeks - 1
      maxProjectDurationWeeks: Math.max(2, projectConfig.totalWeeks - 1),
      minProjectDurationWeeks: 2,
    },
  });
}

// Type import workaround — DailyTopic is imported in course-db.ts but not
// exported. We redeclare the shape we need here to avoid a circular import.
interface DailyTopic {
  title: string;
  objective: string;
  resources: { label: string; url: string }[];
}
