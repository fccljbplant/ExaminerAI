/**
 * Learner behavioural analysis is a private learner-support signal. Until an
 * approved consented support-data pathway exists, only the learner themself
 * may receive this field.
 */
export function canExposeLearnerBehavioralAnalysis(
  viewerUserId: string,
  targetUserId: string,
): boolean {
  return viewerUserId === targetUserId;
}
