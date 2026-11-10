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

/**
 * A zero task count means progress cannot be calculated, not that progress
 * is zero. Return null so the UI can present the metric as unavailable.
 */
export function calculateTaskProgress(
  totalTasks: number,
  completedTasks: number,
): number | null {
  if (totalTasks <= 0) return null;
  return Math.round((completedTasks / totalTasks) * 100);
}

/**
 * Calculate attention only from available activity/test evidence.
 * No records means "unavailable"; available evidence with no risk indicators
 * is a genuine score of zero.
 */
export function calculateAttentionScore(
  lastLogDate: Date | null,
  testScores: readonly number[],
  now: Date,
): { score: number | null; reasons: string[] } {
  if (!lastLogDate && testScores.length === 0) {
    return { score: null, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  if (lastLogDate) {
    const days = Math.floor((now.getTime() - lastLogDate.getTime()) / 86_400_000);
    if (days >= 3) {
      score += 30;
      reasons.push(`Inactive ${days} days`);
    } else if (days >= 2) {
      score += 15;
      reasons.push(`Inactive ${days} days`);
    }
  }

  const latest = testScores[testScores.length - 1];
  if (latest !== undefined && latest < 60) {
    score += 25;
    reasons.push(`Last test ${latest}%`);
  }

  if (latest !== undefined && testScores.length >= 2) {
    const previous = testScores[testScores.length - 2];
    if (previous !== undefined && latest < previous - 15) {
      score += 15;
      reasons.push("Test scores declining");
    }
  }

  return { score, reasons };
}

export type AuthorizedCourseSelection =
  | { kind: "selected"; courseId: string }
  | { kind: "selection_required" }
  | { kind: "forbidden" }
  | { kind: "none" };

/**
 * Never silently aggregate a learner's multiple shared courses under one
 * arbitrary course label. A single shared course may be selected implicitly;
 * multiple courses require an explicit, authorised choice.
 */
export function resolveAuthorizedCourseSelection(
  authorizedCourseIds: readonly string[],
  requestedCourseId: string | null,
): AuthorizedCourseSelection {
  const uniqueCourseIds = [...new Set(authorizedCourseIds)];
  if (uniqueCourseIds.length === 0) return { kind: "none" };
  if (requestedCourseId === null) {
    return uniqueCourseIds.length === 1
      ? { kind: "selected", courseId: uniqueCourseIds[0] }
      : { kind: "selection_required" };
  }
  return uniqueCourseIds.includes(requestedCourseId)
    ? { kind: "selected", courseId: requestedCourseId }
    : { kind: "forbidden" };
}
