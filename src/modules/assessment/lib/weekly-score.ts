/** Convert a persisted 0..N score to a percentage, preserving missing data. */
export function getWeeklyScorePercent(
  finalScore: number | null | undefined,
  questionCount: number,
): number | null {
  if (
    !Number.isInteger(questionCount) ||
    questionCount <= 0 ||
    typeof finalScore !== "number" ||
    !Number.isFinite(finalScore) ||
    finalScore < 0 ||
    finalScore > questionCount
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((finalScore / questionCount) * 100)));
}

/** Return a percentage only when every answer has a valid saved score. */
export function getCompleteWeeklyScorePercent(
  answers: Array<{ score: number } | null>,
  questionCount: number,
): number | null {
  if (!Number.isInteger(questionCount) || questionCount <= 0 || answers.length !== questionCount) {
    return null;
  }

  let total = 0;
  for (const answer of answers) {
    if (!answer || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 1) {
      return null;
    }
    total += answer.score;
  }

  return getWeeklyScorePercent(total, questionCount);
}
