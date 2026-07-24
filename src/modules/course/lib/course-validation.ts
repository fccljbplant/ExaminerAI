/**
 * Shared validation helpers for course API routes.
 *
 * Used by:
 *   - POST /api/courses         (create)
 *   - PUT  /api/courses/[id]    (full replace)
 *
 * Centralizing the rules here keeps the two routes consistent and makes
 * it easy to add new constraints (e.g. "max 52 weeks per course") in
 * one place.
 */

export interface CourseWeekInput {
  weekNumber: number;
  phase: string;
  milestone?: string;
  days: CourseDayInput[];
}

export interface CourseDayInput {
  day: number;
  title: string;
  objective?: string;
  whyItMatters?: string;
  topicsCovered?: string[];
  activity?: string;
  deliverable?: string;
  resources?: { label: string; url: string }[];
}

export const COURSE_LIMITS = {
  MIN_WEEKS: 1,
  MAX_WEEKS: 52,
  MIN_DAYS_PER_WEEK: 1,
  MAX_DAYS_PER_WEEK: 7,
  MAX_TITLE_LENGTH: 300,
  MAX_PHASE_LENGTH: 200,
  MAX_MILESTONE_LENGTH: 300,
  MAX_OBJECTIVE_LENGTH: 600,
  MAX_RESOURCES_PER_DAY: 50,
  MAX_RESOURCE_URL_LENGTH: 2048,
  MAX_RESOURCE_LABEL_LENGTH: 200,
} as const;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validate a course name. Returns { ok: false, error } if invalid. */
export function validateCourseName(name: unknown): ValidationResult {
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length > COURSE_LIMITS.MAX_TITLE_LENGTH) {
    return { ok: false, error: `name must be at most ${COURSE_LIMITS.MAX_TITLE_LENGTH} characters` };
  }
  return { ok: true };
}

/** Normalize a resource URL: prepend https:// if the AI returned a bare
 *  domain like "python.org" or "docs.python.org/3/". Returns null if the
 *  URL is hopelessly broken (empty, not a string, or obviously garbage). */
function normalizeResourceUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > COURSE_LIMITS.MAX_RESOURCE_URL_LENGTH) return null;
  // Already has a protocol or is a relative path
  if (/^https?:\/\//.test(trimmed) || /^\//.test(trimmed)) return trimmed;
  // Bare domain like "python.org" or "docs.python.org/3/tutorial" → prepend https://
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return `https://${trimmed}`;
  // Anything else (e.g. "click here", "see docs") — drop it
  return null;
}

/** Validate the weeks array of a course. Returns { ok: false, error } if invalid.
 *
 *  STRICT rules (will reject the course):
 *  - weeks must be an array, 1..MAX_WEEKS entries
 *  - weekNumber must be a positive integer, no duplicates
 *  - phase must be a non-empty string
 *  - Each week must have 1..MAX_DAYS_PER_WEEK days
 *  - day must be a positive integer, no duplicates
 *  - title must be non-empty
 *
 *  LENIENT rules (cleaned up silently rather than rejected):
 *  - resources with empty label or unparseable URL → DROPPED (not fatal)
 *  - bare-domain URLs like "python.org" → normalized to "https://python.org"
 *  - missing optional fields (whyItMatters, activity, deliverable, topicsCovered)
 *    → coerced to empty string / empty array
 *
 *  This avoids the failure mode where one bad AI-generated resource blocks
 *  the entire course creation. The AI is encouraged but not strictly
 *  required to return valid URLs.
 */
export function validateCourseWeeks(weeks: unknown): ValidationResult {
  if (!Array.isArray(weeks)) {
    return { ok: false, error: "weeks must be an array" };
  }

  if (weeks.length < COURSE_LIMITS.MIN_WEEKS) {
    return { ok: false, error: `At least ${COURSE_LIMITS.MIN_WEEKS} week is required` };
  }
  if (weeks.length > COURSE_LIMITS.MAX_WEEKS) {
    return { ok: false, error: `A course can have at most ${COURSE_LIMITS.MAX_WEEKS} weeks` };
  }

  // Check week-level fields + weekNumber sequence
  const seenWeekNumbers = new Set<number>();
  for (const w of weeks as CourseWeekInput[]) {
    if (!w || typeof w !== "object") {
      return { ok: false, error: "Each week must be an object" };
    }
    if (!Number.isInteger(w.weekNumber) || w.weekNumber < 1) {
      return { ok: false, error: "weekNumber must be a positive integer (1-indexed)" };
    }
    if (seenWeekNumbers.has(w.weekNumber)) {
      return { ok: false, error: `Duplicate weekNumber: ${w.weekNumber}` };
    }
    seenWeekNumbers.add(w.weekNumber);

    if (typeof w.phase !== "string" || !w.phase.trim()) {
      return { ok: false, error: `Week ${w.weekNumber}: phase is required` };
    }
    if (w.phase.length > COURSE_LIMITS.MAX_PHASE_LENGTH) {
      return { ok: false, error: `Week ${w.weekNumber}: phase must be at most ${COURSE_LIMITS.MAX_PHASE_LENGTH} characters` };
    }
    if (w.milestone && w.milestone.length > COURSE_LIMITS.MAX_MILESTONE_LENGTH) {
      return { ok: false, error: `Week ${w.weekNumber}: milestone must be at most ${COURSE_LIMITS.MAX_MILESTONE_LENGTH} characters` };
    }

    // Validate days
    if (!Array.isArray(w.days)) {
      return { ok: false, error: `Week ${w.weekNumber}: days must be an array` };
    }
    if (w.days.length < COURSE_LIMITS.MIN_DAYS_PER_WEEK) {
      return { ok: false, error: `Week ${w.weekNumber}: must have at least ${COURSE_LIMITS.MIN_DAYS_PER_WEEK} day` };
    }
    if (w.days.length > COURSE_LIMITS.MAX_DAYS_PER_WEEK) {
      return { ok: false, error: `Week ${w.weekNumber}: cannot have more than ${COURSE_LIMITS.MAX_DAYS_PER_WEEK} days` };
    }

    const seenDayNumbers = new Set<number>();
    for (const d of w.days as CourseDayInput[]) {
      if (!d || typeof d !== "object") {
        return { ok: false, error: `Week ${w.weekNumber}: each day must be an object` };
      }
      if (!Number.isInteger(d.day) || d.day < 1) {
        return { ok: false, error: `Week ${w.weekNumber}: day must be a positive integer (1-indexed)` };
      }
      if (seenDayNumbers.has(d.day)) {
        return { ok: false, error: `Week ${w.weekNumber}: duplicate day ${d.day}` };
      }
      seenDayNumbers.add(d.day);

      if (typeof d.title !== "string" || !d.title.trim()) {
        return { ok: false, error: `Week ${w.weekNumber} Day ${d.day}: title is required` };
      }
      if (d.title.length > COURSE_LIMITS.MAX_TITLE_LENGTH) {
        return { ok: false, error: `Week ${w.weekNumber} Day ${d.day}: title must be at most ${COURSE_LIMITS.MAX_TITLE_LENGTH} characters` };
      }
      if (d.objective && d.objective.length > COURSE_LIMITS.MAX_OBJECTIVE_LENGTH) {
        return { ok: false, error: `Week ${w.weekNumber} Day ${d.day}: objective must be at most ${COURSE_LIMITS.MAX_OBJECTIVE_LENGTH} characters` };
      }

      // Resources: lenient. Drop bad entries instead of rejecting the whole course.
      // (See normalizeResourceUrl for what counts as "bad".)
      if (d.resources !== undefined) {
        if (!Array.isArray(d.resources)) {
          return { ok: false, error: `Week ${w.weekNumber} Day ${d.day}: resources must be an array` };
        }
        if (d.resources.length > COURSE_LIMITS.MAX_RESOURCES_PER_DAY) {
          return { ok: false, error: `Week ${w.weekNumber} Day ${d.day}: cannot have more than ${COURSE_LIMITS.MAX_RESOURCES_PER_DAY} resources` };
        }
        // Mutate in place: drop bad resources, normalize bare-domain URLs.
        // The caller will see the cleaned-up array when they persist it.
        const cleaned: { label: string; url: string }[] = [];
        for (const r of d.resources) {
          if (!r || typeof r !== "object") continue;
          const label = typeof r.label === "string" ? r.label.trim() : "";
          if (!label || label.length > COURSE_LIMITS.MAX_RESOURCE_LABEL_LENGTH) continue;
          const url = normalizeResourceUrl(r.url);
          if (!url) continue;
          cleaned.push({ label, url });
        }
        d.resources = cleaned;
      }
    }
  }

  return { ok: true };
}
