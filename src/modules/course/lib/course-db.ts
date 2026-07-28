/**
 * DB-backed course outline functions.
 *
 * These mirror the functions in course-topics.ts but read from the database
 * (Course + CourseWeek + CourseDay models) instead of the hardcoded array.
 *
 * FALLBACK: If the user's batch has no courseId, or the course doesn't exist
 * in the DB, ALL functions fall back to the hardcoded WEEKLY_TOPICS in
 * course-topics.ts. This ensures backward compatibility — existing deployments
 * continue to work until an admin creates + assigns a course.
 */

import { db } from "@/lib/db";
import {
  WEEKLY_TOPICS,
  getWeekTopics as getHardcodedTopics,
  getWeekTopicTitles as getHardcodedTitles,
  getWeekPhase as getHardcodedPhase,
  getBootcampDayNumber,
  type DailyTopic,
  type WeekTopic,
} from "./course-topics";

/** Load the full course outline from the DB for a given user.
 *  Returns null if the user's batch has no course assigned (caller falls back). */
async function loadCourseFromDB(userId: string): Promise<WeekTopic[] | null> {
  const enrollment = await db.courseEnrollment.findFirst({
    where: { userId, role: "student" },
    select: { courseId: true },
  });

  if (!enrollment) return null;

  const course = await db.course.findUnique({
    where: { id: enrollment.courseId, isActive: true },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { day: "asc" } },
        },
      },
    },
  });

  if (!course) return null;

  return course.weeks.map((w) => ({
    week: w.weekNumber,
    phase: w.phase,
    topics: w.days.map((d) => ({
      title: d.title,
      objective: d.objective,
      resources: (() => {
        try { return JSON.parse(d.resources || "[]"); } catch { return []; }
      })(),
      whyItMatters: d.whyItMatters,
      topicsCovered: (() => { try { return JSON.parse(d.topicsCovered || "[]"); } catch { return []; } })(),
      activity: d.activity,
      deliverable: d.deliverable,
    } as unknown as DailyTopic)),
  }));
}

/** Get all week topics for a user (from DB or fallback to hardcoded). */
export async function getCourseTopics(userId: string): Promise<WeekTopic[]> {
  const dbTopics = await loadCourseFromDB(userId);
  return dbTopics ?? WEEKLY_TOPICS;
}

/** Get topics (DailyTopic[]) for a specific week. */
export async function getCourseWeekTopics(userId: string, week: number): Promise<DailyTopic[]> {
  const all = await getCourseTopics(userId);
  return all.find((t) => t.week === week)?.topics ?? [];
}

/** Get topic titles (string[]) for a specific week — mirrors getWeekTopicTitles. */
export async function getCourseWeekTopicTitles(userId: string, week: number): Promise<string[]> {
  const topics = await getCourseWeekTopics(userId, week);
  return topics.map((t) => t.title);
}

/** Get the phase name for a specific week. */
export async function getCourseWeekPhase(userId: string, week: number): Promise<string> {
  const all = await getCourseTopics(userId);
  return all.find((t) => t.week === week)?.phase ?? `Week ${week}`;
}

/** Get today's topic for a user. */
// L4: deprecated — not used externally, but kept for potential future use
export async function getCourseTodayTopic(userId: string): Promise<DailyTopic | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currentWeek: true },
  });
  if (!user) return null;

  const todayDay = getBootcampDayNumber(new Date());
  const topics = await getCourseWeekTopics(userId, user.currentWeek);
  return topics[todayDay - 1] ?? topics[0] ?? null;
}

/** Get the number of weeks in the course (default 6 from hardcoded). */
export async function getCourseDurationWeeks(userId: string): Promise<number> {
  const all = await getCourseTopics(userId);
  return all.length;
}

/** Build a topic context string for AI prompts (same shape as getWeekTopicContext). */
// L4: deprecated — not used externally, but kept for potential future use
export async function getCourseWeekTopicContext(userId: string, week: number): Promise<string> {
  const topics = await getCourseWeekTopics(userId, week);
  const phase = await getCourseWeekPhase(userId, week);
  return `Week ${week}: ${phase}. Topics covered this week:\n${topics
    .map((t, i) => `Day ${i + 1}: ${t.title}`)
    .join("\n")}`;
}

/** Phase 2.2: Get the course's domain metadata (tools, deliverables, domain,
 *  level, assessmentType) for AI prompt customization. Returns null if the
 *  user has no course assigned (caller falls back to defaults). */
export async function getCourseMetadata(userId: string): Promise<{
  domain: string;
  level: string;
  assessmentType: string;
  toolsUsed: string[];
  deliverableTypes: string[];
  name: string;
  description: string;
} | null> {
  try {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId, role: "student" },
      select: { courseId: true },
    });
    if (!enrollment) return null;

    const course = await db.course.findUnique({
      where: { id: enrollment.courseId, isActive: true },
      select: {
        name: true,
        description: true,
        domain: true,
        level: true,
        assessmentType: true,
        toolsUsed: true,
        deliverableTypes: true,
      },
    });
    if (!course) return null;

    const parseJSON = (str: string | null, fallback: string[] = []): string[] => {
      try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
    };

    return {
      name: course.name,
      description: course.description,
      domain: course.domain,
      level: course.level,
      assessmentType: course.assessmentType,
      toolsUsed: parseJSON(course.toolsUsed),
      deliverableTypes: parseJSON(course.deliverableTypes),
    };
  } catch {
    return null;
  }
}

/** Get the project configuration for a user's assigned course.
 *  Returns null if the user has no course assigned.
 *  Used by the student dashboard to decide whether to show the Project nav,
 *  the project banners, and to validate projectDurationWeeks against courseWeeks. */
export async function getCourseProjectConfig(userId: string): Promise<{
  courseAssigned: boolean;
  courseId: string | null;
  courseName: string | null;
  totalWeeks: number;
  projectEnabled: boolean;
  projectRequired: boolean;
  projectDefaultDurationWeeks: number;
}> {
  try {
    const enrollment = await db.courseEnrollment.findFirst({
      where: { userId, role: "student" },
      select: { courseId: true },
    });
    if (!enrollment) {
      return {
        courseAssigned: false,
        courseId: null,
        courseName: null,
        totalWeeks: 0,
        projectEnabled: false,
        projectRequired: false,
        projectDefaultDurationWeeks: 4,
      };
    }

    const course = await db.course.findUnique({
      where: { id: enrollment.courseId, isActive: true },
      select: {
        id: true,
        name: true,
        projectEnabled: true,
        projectRequired: true,
        projectDefaultDurationWeeks: true,
        weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } },
      },
    });
    if (!course) {
      return {
        courseAssigned: false,
        courseId: null,
        courseName: null,
        totalWeeks: 0,
        projectEnabled: false,
        projectRequired: false,
        projectDefaultDurationWeeks: 4,
      };
    }

    return {
      courseAssigned: true,
      courseId: course.id,
      courseName: course.name,
      totalWeeks: course.weeks.length,
      projectEnabled: course.projectEnabled && course.weeks.length >= 4,
      projectRequired: course.projectRequired && course.projectEnabled && course.weeks.length >= 4,
      projectDefaultDurationWeeks: course.projectDefaultDurationWeeks,
    };
  } catch {
    return {
      courseAssigned: false,
      courseId: null,
      courseName: null,
      totalWeeks: 0,
      projectEnabled: false,
      projectRequired: false,
      projectDefaultDurationWeeks: 4,
    };
  }
}

// Re-export the shared helper (no DB needed)
export { getBootcampDayNumber } from "./course-topics";
