// FILE: src/lib/learning-signal.ts
// REPLACES the deleted 7-dimension psych pipeline for mentor triage.
// Inputs are facts (scores, completion, activity, deadlines) — nothing
// linguistic, nothing hidden. Every component is displayed to the trainee.

export interface SignalInputs {
  recentScores: number[];       // last 10 assessment scores
  submissionsExpected: number;  // due in window
  submissionsDone: number;
  activeDays: number;           // active days in last 7
  missedDeadlines: number;
}

export interface LearningSignal {
  score: number;                // 0-100
  trend: "up" | "steady" | "down";
  components: { name: string; value: number; weight: number }[];
  tier: "green" | "amber" | "red";
}

/** Compute a transparent 0-100 learning signal from academic facts only.
 *  - 45% weight: average score (last 10 assessments)
 *  - 30% weight: on-time completion rate
 *  - 25% weight: active days (last 7 days, target = 5)
 *  - minus deadline penalty (up to -30)
 *  Every component is returned so the UI can display it openly. */
export function computeLearningSignal(inputs: SignalInputs): LearningSignal {
  const avgScore = inputs.recentScores.length
    ? inputs.recentScores.reduce((a, b) => a + b, 0) / inputs.recentScores.length : 0;
  const completion = inputs.submissionsExpected
    ? Math.min(100, (inputs.submissionsDone / inputs.submissionsExpected) * 100) : 100;
  const activity = Math.min(100, (inputs.activeDays / 5) * 100);
  const deadlinePenalty = Math.min(30, inputs.missedDeadlines * 10);

  const components = [
    { name: "Average score",     value: Math.round(avgScore),   weight: 0.45 },
    { name: "Completed on time", value: Math.round(completion), weight: 0.30 },
    { name: "Active days",       value: Math.round(activity),   weight: 0.25 },
  ];

  const raw = components.reduce((acc, c) => acc + c.value * c.weight, 0) - deadlinePenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // Trend: compare first-half avg vs second-half avg of recentScores
  const half = Math.floor(inputs.recentScores.length / 2);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const delta = mean(inputs.recentScores.slice(half)) - mean(inputs.recentScores.slice(0, half));
  const trend: LearningSignal["trend"] = delta > 5 ? "up" : delta < -5 ? "down" : "steady";

  return { score, trend, components, tier: score >= 70 ? "green" : score >= 45 ? "amber" : "red" };
}

/** Fetch the inputs for a student's learning signal from the DB.
 *  Non-blocking — callers should use `void recordLearningSignal(userId).catch((err) => { logger.warn("Operation failed", { err }); })`. */
export async function gatherSignalInputs(userId: string): Promise<SignalInputs> {
  // Lazy import to avoid circular dependency at module load time
  const { db } = await import("@/lib/db");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400_000);

  // Recent scores: last 10 completed weekly tests + daily tests
  const [weeklyTests, dailyTests, dailyLogs, projectTasks] = await Promise.all([
    db.weeklyTest.findMany({
      where: { userId, status: "completed", completedAt: { gte: fourteenDaysAgo } },
      select: { score: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    db.dailyTest.findMany({
      where: { userId, status: "completed" },
      select: { score: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.dailyLog.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      select: { date: true },
      distinct: ["date"],
    }),
    db.projectTask.findMany({
      where: { userId, dueDate: { not: null } },
      select: { id: true, status: true, dueDate: true },
    }),
  ]);

  const recentScores: number[] = [
    ...weeklyTests.map((t) => t.score ?? 0),
    ...dailyTests.map((t) => t.score ?? 0),
  ].slice(0, 10);

  // dueDate is stored as ISO string — filter by parsed date
  const nowMs = now.getTime();
  const windowStartMs = fourteenDaysAgo.getTime();
  const tasksInWindow = projectTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    return due >= windowStartMs && due <= nowMs;
  });
  const submissionsExpected = tasksInWindow.length;
  const submissionsDone = tasksInWindow.filter((t) => t.status === "completed").length;
  const missedDeadlines = tasksInWindow.filter(
    (t) => t.status !== "completed" && new Date(t.dueDate!).getTime() < nowMs
  ).length;
  const activeDays = dailyLogs.length;

  return {
    recentScores,
    submissionsExpected,
    submissionsDone,
    activeDays,
    missedDeadlines,
  };
}

/** Compute + persist the learning signal for a student.
 *  Currently returns the signal (no persistence — the signal is computed live
 *  on demand by /api/today/summary). Could be cached in a future iteration. */
export async function recordLearningSignal(userId: string): Promise<LearningSignal> {
  const inputs = await gatherSignalInputs(userId);
  return computeLearningSignal(inputs);
}
