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
 * Keep confidence calibration private to the learner's instructor.
 * Organisation admins receive attendance dates for operational oversight,
 * not learner-support/confidence indicators.
 */
export function toDailyLogPayload(
  log: DailyLogForDetail,
  includeSupportSignals: boolean,
): { date: string; confidence?: number | null } {
  const date = log.date.toISOString().slice(0, 10);
  if (!includeSupportSignals) return { date };
  return { date, confidence: log.confidence ?? null };
}
