/**
 * modules/learn/lib/study-flow-db.ts — W3 DB wrapper
 *
 * Thin async functions that read from Prisma, call the pure engine
 * (study-flow.ts), and return domain results. This is the ONLY file
 * in the study-flow subsystem that imports `db`.
 */

import { db } from "@/lib/db";
import {
  detectAbsence,
  detectCram,
  generatePlan,
  inferCadence,
  srsSchedule,
  tutorContext,
  suggestBudget,
  type AbsenceResult,
  type CramResult,
  type PlanItem,
  type SrsScheduleResult,
  type StudyScenario,
  type TutorContextResult,
  type BudgetMinutes,
} from "./study-flow";

// ── Absence ──────────────────────────────────────────────────────────────

/**
 * Get the learner's absence status for a course.
 * Reads LearnProfile.lastActivityDate and EngagementEvent cadence.
 */
export async function getAbsenceStatus(
  userId: string,
  courseId: string,
): Promise<AbsenceResult> {
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { lastActivityDate: true },
  });

  return detectAbsence(profile?.lastActivityDate ?? null);
}

// ── Cram ─────────────────────────────────────────────────────────────────

/**
 * Detect cramming for a learner in a course.
 * Reads today's EngagementEvents of type session.start.
 */
export async function getCramStatus(
  userId: string,
  courseId: string,
): Promise<CramResult> {
  const since = new Date(Date.now() - 24 * 3600_000);

  const events = await db.engagementEvent.findMany({
    where: {
      userId,
      courseId,
      eventType: "session.start",
      createdAt: { gte: since },
    },
    select: { createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });

  const sessions = events.map((e) => {
    const meta = e.metadata as { endedAt?: string } | null;
    return {
      startedAt: e.createdAt,
      endedAt: meta?.endedAt ? new Date(meta.endedAt) : null,
    };
  });

  // Get personal cadence for baseline.
  const allEvents = await db.engagementEvent.findMany({
    where: { userId, courseId, eventType: "session.start" },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const cadence = inferCadence(allEvents.map((e) => e.createdAt));
  const baselinePerHour = Math.max(0.5, cadence / 5); // normalise to per-hour

  return detectCram(sessions, baselinePerHour);
}

// ── Study Plan ───────────────────────────────────────────────────────────

/**
 * Generate a study plan for a learner in a course.
 */
export async function getStudyPlan(
  userId: string,
  courseId: string,
  budgetMin: number = 30,
): Promise<PlanItem[]> {
  // 1) Journey steps (pending/active).
  const journey = await db.journeyPlan.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      steps: {
        where: { status: { in: ["pending", "active"] } },
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  const journeySteps = (journey?.steps ?? []).map((s) => ({
    stepOrder: s.stepOrder,
    stepType: s.stepType,
    title: s.title,
    status: s.status,
    estMin: 10, // default estimate
  }));

  // 2) Due SRS cards.
  const now = new Date();
  const drillCards = await db.drillCard.findMany({
    where: {
      userId,
      dueAt: { lte: now },
      masteredAt: null,
    },
    orderBy: { dueAt: "asc" },
    take: 20,
  });

  const drillCardsDue = drillCards.map((c) => ({
    id: c.id,
    topic: c.topic,
    dueAt: c.dueAt,
    attempts: c.attempts,
    lastScore: c.lastScore,
  }));

  // 3) Weak topics — derive from masteryMap or recent low scores.
  const weakTopics = extractWeakTopics(userId, courseId);

  // 4) Upcoming exam?
  const examEvent = await db.event.findFirst({
    where: {
      courseId,
      type: "deadline",
      startDate: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) },
    },
    select: { title: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  const exam = examEvent
    ? {
        title: examEvent.title,
        daysUntil: Math.ceil(
          (examEvent.startDate.getTime() - now.getTime()) / 86_400_000,
        ),
      }
    : undefined;

  return generatePlan({
    journeySteps,
    drillCardsDue,
    weakTopics,
    budgetMin,
    examEvent: exam,
  });
}

/**
 * Extract weak topics from recent DailyLog / test performance.
 * Falls back to an empty array when no signal is available.
 */
function extractWeakTopics(_userId: string, _courseId: string): string[] {
  // TODO (W3 follow-up): parse masteryMap JSON for topics with low
  // completion rate, or aggregate DrillCard topics with avg lastScore < 60.
  // For now return empty — the plan still works with SRS + journey items.
  return [];
}

// ── SRS ──────────────────────────────────────────────────────────────────

/**
 * Get the SRS review queue for a learner in a course.
 */
export async function getSrsQueue(userId: string, _courseId: string) {
  const now = new Date();
  return db.drillCard.findMany({
    where: {
      userId,
      dueAt: { lte: now },
      masteredAt: null,
    },
    orderBy: { dueAt: "asc" },
    take: 20,
    select: {
      id: true,
      topic: true,
      dueAt: true,
      attempts: true,
      lastScore: true,
    },
  });
}

/**
 * Review an SRS card — update its schedule based on the score.
 */
export async function reviewSrsCard(
  userId: string,
  cardId: string,
  score: number,
): Promise<SrsScheduleResult> {
  const card = await db.drillCard.findFirst({
    where: { id: cardId, userId },
  });
  if (!card) throw new Error("Card not found or not owned by user");

  const schedule = srsSchedule({
    attempts: card.attempts + 1,
    lastScore: score,
  });

  const masteredAt =
    score >= 90 && card.attempts >= 2 ? new Date() : card.masteredAt;

  await db.drillCard.update({
    where: { id: cardId },
    data: {
      dueAt: schedule.dueAt,
      attempts: card.attempts + 1,
      lastScore: score,
      masteredAt,
    },
  });

  return schedule;
}

// ── Budget suggestion ────────────────────────────────────────────────────

/**
 * Suggest a time budget from the learner's recent session history.
 */
export async function getSuggestedBudget(
  userId: string,
  _courseId: string,
): Promise<BudgetMinutes> {
  const recent = await db.engagementEvent.findMany({
    where: { userId, eventType: "session.end" },
    select: { metadata: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const durations = recent
    .map((e) => {
      const meta = e.metadata as { durationMin?: number } | null;
      return meta?.durationMin ?? 0;
    })
    .filter((d) => d > 0);

  return suggestBudget(durations);
}

// ── Tutor context ────────────────────────────────────────────────────────

/**
 * Build the full tutor context for the AI tutor's system prompt.
 * Combines absence, cram, exam proximity, and profile data.
 */
export async function getTutorContext(
  userId: string,
  courseId: string,
  surface: string,
): Promise<TutorContextResult> {
  const [absence, cram, profile, examSoon] = await Promise.all([
    getAbsenceStatus(userId, courseId),
    getCramStatus(userId, courseId),
    db.learnProfile.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { course: { select: { name: true } }, streakCurrent: true },
    }),
    db.event.findFirst({
      where: {
        courseId,
        type: "deadline",
        startDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 86_400_000),
        },
      },
      select: { id: true },
    }),
  ]);

  return tutorContext({
    absence,
    cram,
    hasExamSoon: !!examSoon,
    budgetMin: null,
    courseName: profile?.course.name ?? null,
    streak: profile?.streakCurrent ?? 0,
    surface,
  });
}

// ── Scenario detection (composite) ───────────────────────────────────────

/**
 * Get the learner's current study scenario for a course.
 * Useful for the Study-Flow Center UI to decide which cards to show.
 */
export async function getStudyScenario(
  userId: string,
  courseId: string,
): Promise<{
  scenario: StudyScenario;
  absence: AbsenceResult;
  cram: CramResult;
  budget: BudgetMinutes;
}> {
  const [absence, cram, budget] = await Promise.all([
    getAbsenceStatus(userId, courseId),
    getCramStatus(userId, courseId),
    getSuggestedBudget(userId, courseId),
  ]);

  const examSoon = !!(await db.event.findFirst({
    where: {
      courseId,
      type: "deadline",
      startDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 86_400_000),
      },
    },
    select: { id: true },
  }));

  const ctx = tutorContext({
    absence,
    cram,
    hasExamSoon: examSoon,
    budgetMin: budget,
    courseName: null,
    streak: 0,
    surface: "",
  });

  return { scenario: ctx.activeScenario, absence, cram, budget };
}
