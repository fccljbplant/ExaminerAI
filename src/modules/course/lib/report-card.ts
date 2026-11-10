export type CourseRetakePolicy = "best" | "latest" | "first";

export interface CourseReportCardGradingPolicy {
  gradingScale: Array<{ grade: string; min: number; max: number }>;
  weights: { weeklyTest: number; practice: number };
}

export interface CourseReportCardEvidence {
  tasks: Array<{ status: string }>;
  practiceScores: number[];
  weeklyTests: Array<{ attempt: number; status: string; score: number | null }>;
  dailyCheckinCount: number;
}

export interface CourseReportCardResult {
  hasEvidence: boolean;
  score: number | null;
  grade: string | null;
  strengths: string[];
  weaknesses: string[];
  progress: string;
  nextSteps: string[];
  weeklyTestScore: number | null;
  selectedAttempt: number | null;
  practiceAverage: number | null;
  taskCompletionRate: number | null;
}

export function parseCourseReportCardPolicy(raw: string | null | undefined): CourseReportCardGradingPolicy | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CourseReportCardGradingPolicy>;
    const scale = value.gradingScale;
    const weights = value.weights;
    if (
      !Array.isArray(scale) ||
      scale.length === 0 ||
      !scale.every((entry) =>
        typeof entry?.grade === "string" &&
        entry.grade.trim().length > 0 &&
        Number.isFinite(entry.min) &&
        Number.isFinite(entry.max) &&
        entry.min <= entry.max
      ) ||
      !weights ||
      !Number.isFinite(weights.weeklyTest) ||
      !Number.isFinite(weights.practice) ||
      weights.weeklyTest < 0 ||
      weights.practice < 0 ||
      weights.weeklyTest + weights.practice <= 0
    ) {
      return null;
    }
    return {
      gradingScale: scale.map((entry) => ({ grade: entry.grade, min: entry.min, max: entry.max })),
      weights: { weeklyTest: weights.weeklyTest, practice: weights.practice },
    };
  } catch {
    return null;
  }
}

export function buildCourseReportCard(
  evidence: CourseReportCardEvidence,
  policy: CourseReportCardGradingPolicy | null,
  retakePolicy: CourseRetakePolicy = "best",
): CourseReportCardResult {
  const completedTests = evidence.weeklyTests
    .filter((test) => test.status === "completed" && typeof test.score === "number" && Number.isFinite(test.score))
    .sort((a, b) => a.attempt - b.attempt);

  let selectedTest = completedTests[completedTests.length - 1] ?? null;
  if (completedTests.length > 0 && retakePolicy === "first") {
    selectedTest = completedTests[0];
  } else if (completedTests.length > 0 && retakePolicy === "best") {
    selectedTest = [...completedTests].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.attempt - a.attempt)[0];
  }

  const weeklyTestScore = selectedTest?.score ?? null;
  const validPracticeScores = evidence.practiceScores.filter(
    (score) => Number.isFinite(score) && score >= 0 && score <= 100,
  );
  const practiceAverage = validPracticeScores.length
    ? Math.round(validPracticeScores.reduce((sum, score) => sum + score, 0) / validPracticeScores.length)
    : null;
  const totalTasks = evidence.tasks.length;
  const completedTasks = evidence.tasks.filter((task) => task.status === "completed").length;
  const taskCompletionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : null;

  const hasEvidence =
    evidence.weeklyTests.length > 0 ||
    evidence.practiceScores.length > 0 ||
    totalTasks > 0 ||
    evidence.dailyCheckinCount > 0;

  const weightedMetrics = [
    { value: weeklyTestScore, weight: policy?.weights.weeklyTest ?? 0 },
    { value: practiceAverage, weight: policy?.weights.practice ?? 0 },
  ].filter((metric): metric is { value: number; weight: number } =>
    metric.value !== null && metric.weight > 0,
  );
  const totalWeight = weightedMetrics.reduce((sum, metric) => sum + metric.weight, 0);
  const score = policy && totalWeight > 0
    ? Math.round(weightedMetrics.reduce((sum, metric) => sum + metric.value * metric.weight, 0) / totalWeight)
    : null;
  const grade = score === null
    ? null
    : policy?.gradingScale.find((entry) => score >= entry.min && score <= entry.max)?.grade ?? null;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (taskCompletionRate !== null && taskCompletionRate >= 75) {
    strengths.push(`Strong course-task completion (${completedTasks}/${totalTasks}, ${taskCompletionRate}%)`);
  } else if (taskCompletionRate !== null && taskCompletionRate < 50) {
    weaknesses.push(`Course-task completion needs attention (${completedTasks}/${totalTasks}, ${taskCompletionRate}%)`);
  }
  if (practiceAverage !== null && practiceAverage >= 75) {
    strengths.push(`Practice performance: ${practiceAverage}% average`);
  } else if (practiceAverage !== null && practiceAverage < 60) {
    weaknesses.push(`Practice performance: ${practiceAverage}% average`);
  }
  if (weeklyTestScore !== null && weeklyTestScore >= 75) {
    strengths.push(`Weekly test performance: ${weeklyTestScore}%`);
  } else if (weeklyTestScore !== null && weeklyTestScore < 60) {
    weaknesses.push(`Weekly test performance: ${weeklyTestScore}%`);
  }
  if (evidence.dailyCheckinCount >= 3) {
    strengths.push(`${evidence.dailyCheckinCount} course check-ins recorded this week`);
  }

  const latestTest = [...evidence.weeklyTests].sort((a, b) => b.attempt - a.attempt)[0] ?? null;
  const nextSteps: string[] = [];
  if (!latestTest || latestTest.status !== "completed") {
    nextSteps.push(latestTest?.status === "in-progress"
      ? "Complete the in-progress weekly test for this course week"
      : "Take the weekly test for this course week");
  }
  if (practiceAverage === null) nextSteps.push("Complete practice activities to establish a practice result");
  if (taskCompletionRate !== null && taskCompletionRate < 100) {
    nextSteps.push("Complete the remaining course tasks");
  }
  if (score === null && hasEvidence) {
    nextSteps.push("A course grading policy is required before an overall grade can be assigned");
  }
  if (nextSteps.length === 0 && hasEvidence) nextSteps.push("Continue with the next course activity");

  const taskSummary = taskCompletionRate === null
    ? "unavailable"
    : `${completedTasks}/${totalTasks} (${taskCompletionRate}%)`;
  const testSummary = weeklyTestScore !== null
    ? `${weeklyTestScore}% (attempt ${selectedTest?.attempt})`
    : latestTest?.status === "in-progress"
      ? "in progress; score unavailable"
      : latestTest?.status === "completed"
        ? "completed; score unavailable"
        : "not attempted";
  const overallSummary = score === null
    ? "unavailable"
    : `${score}%${grade ? ` (${grade})` : " (grade scale unavailable)"}`;
  const progress = [
    `Tasks: ${taskSummary}`,
    `Practice: ${practiceAverage === null ? "unavailable" : `${practiceAverage}%`}`,
    `Weekly test: ${testSummary}`,
    `Check-ins: ${evidence.dailyCheckinCount}`,
    `Overall: ${overallSummary}`,
    ...(score === null && hasEvidence ? ["No overall grade assigned because a valid course grading policy or weighted assessment evidence is unavailable."] : []),
  ].join(". ");

  return {
    hasEvidence,
    score,
    grade,
    strengths,
    weaknesses,
    progress,
    nextSteps,
    weeklyTestScore,
    selectedAttempt: selectedTest?.attempt ?? null,
    practiceAverage,
    taskCompletionRate,
  };
}
