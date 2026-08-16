// src/modules/learn/lib/course-outline.ts — course-specific outline + progression.
/**
 * The Learn platform teaches each course's OWN outline (CourseWeek /
 * CourseDay rows created by the Course Planner, seeds or AI generation).
 *
 * This module loads that outline and provides progression helpers
 * (next / prev / bounds) scoped to it. When a course has NO outline
 * rows, callers fall back to the legacy 6×5 WEEKLY_TOPICS ladder.
 *
 * Pure helpers take the outline as a plain array so they can be unit
 * tested without a database.
 */

import { db } from "@/lib/db";

export interface OutlineDay {
  day: number;
  title: string;
  objective: string;
  activity: string | null;
  deliverable: string | null;
}

export interface OutlineWeek {
  week: number;
  phase: string;
  days: OutlineDay[];
}

/** Load the course's outline from CourseWeek/CourseDay. Null when the
 *  course has no outline rows (caller should use the legacy ladder). */
export async function getCourseOutline(courseId: string): Promise<OutlineWeek[] | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { day: "asc" } } },
      },
    },
  });
  if (!course || course.weeks.length === 0) return null;
  return course.weeks.map((w) => ({
    week: w.weekNumber,
    phase: w.phase,
    days: w.days.map((d) => ({
      day: d.day,
      title: d.title,
      objective: d.objective,
      activity: d.activity,
      deliverable: d.deliverable,
    })),
  }));
}

/** Find the (week, day) topic inside an outline, or null when the
 *  position falls outside the course's own weeks/days. */
export function topicInOutline(
  outline: OutlineWeek[],
  week: number,
  day: number,
): OutlineDay | null {
  const w = outline.find((o) => o.week === week);
  if (!w) return null;
  return w.days.find((d) => d.day === day) ?? null;
}

/** Next (week, day) after the given position within the outline, or
 *  null at course end. Skips weeks with no days. */
export function nextTopicInOutline(
  outline: OutlineWeek[],
  week: number,
  day: number,
): { week: number; day: number } | null {
  const w = outline.find((o) => o.week === week);
  if (!w) return null;
  const nextDay = w.days.find((d) => d.day > day);
  if (nextDay) return { week, day: nextDay.day };
  // Fall through to the following weeks in order.
  const rest = outline.filter((o) => o.week > week);
  for (const r of rest) {
    if (r.days.length > 0) return { week: r.week, day: r.days[0].day };
  }
  return null;
}

/** Previous (week, day) before the given position within the outline,
 *  or null at course start. */
export function prevTopicInOutline(
  outline: OutlineWeek[],
  week: number,
  day: number,
): { week: number; day: number } | null {
  const w = outline.find((o) => o.week === week);
  if (!w) return null;
  const prevDay = [...w.days].reverse().find((d) => d.day < day);
  if (prevDay) return { week, day: prevDay.day };
  const earlier = outline.filter((o) => o.week < week).reverse();
  for (const e of earlier) {
    if (e.days.length > 0) {
      const last = e.days[e.days.length - 1];
      return { week: e.week, day: last.day };
    }
  }
  return null;
}

/** True when the position is the last topic of the outline. */
export function isLastTopicInOutline(
  outline: OutlineWeek[],
  week: number,
  day: number,
): boolean {
  return nextTopicInOutline(outline, week, day) === null;
}
