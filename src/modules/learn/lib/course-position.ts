/**
 * Shared course-position helpers (REDESIGN-P3 §L11).
 *
 * Reads the learner's current { week, day } position out of a
 * LearnProfile.masteryMap and turns it into a coarse completion
 * percent against the course's week count. Used by the progress
 * API (ring denominators) and the /learn hero (resume context).
 */

export interface CoursePosition {
  week: number;
  day: number;
}

export function readPosition(masteryMap: unknown): CoursePosition | null {
  if (!masteryMap) return null;
  const m = masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } };
  const cur = m.topicProgress?.current;
  return cur?.week ? { week: cur.week, day: cur.day ?? 1 } : null;
}

/** Coarse ring: days completed before the current position / total days. */
export function ringPercent(pos: CoursePosition | null, totalWeeks: number): number {
  if (!pos || totalWeeks <= 0) return 0;
  const totalDays = totalWeeks * 7;
  const completedDays = (pos.week - 1) * 7 + (pos.day - 1);
  return Math.min(100, Math.round((completedDays / totalDays) * 100));
}
