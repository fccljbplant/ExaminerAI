export function canViewLearnerSupportSignals(
  role: string,
  consentGranted = false,
  featureEnabled = false,
): boolean {
  // Support data is default-off. Role alone never constitutes consent.
  return role === "instructor" && consentGranted && featureEnabled;
}

type DailyLogForDetail = {
  date: Date;
  confidence?: number | null;
};

/**
 * Confidence is included only when the caller has independently verified
 * both learner consent and the organisation's support feature gate.
 */
export function toDailyLogPayload(
  log: DailyLogForDetail,
  includeSupportSignals: boolean,
): { date: string; confidence?: number | null } {
  const date = log.date.toISOString().slice(0, 10);
  if (!includeSupportSignals) return { date };
  return { date, confidence: log.confidence ?? null };
}

/**
 * Keep learner drill-down data inside courses both assigned to the staff
 * member and enrolled by the learner. Unattributed course records
 * are intentionally excluded by the route's exact courseId filter.
 */
export function getAuthorizedStudentCourseIds(
  staffCourseIds: readonly string[],
  learnerCourseIds: readonly string[],
): string[] {
  const learnerCourses = new Set(learnerCourseIds);
  return [...new Set(staffCourseIds)].filter((courseId) => learnerCourses.has(courseId));
}
