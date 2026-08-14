/**
 * modules/learn/lib/study-flow.ts — W3 Study-Flow Engine (pure functions)
 *
 * All functions here are PURE — no DB calls, no side effects. They operate
 * on plain data structures so they can be unit-tested with fixture data.
 * The thin DB wrapper lives in `study-flow-db.ts`.
 *
 * Six scenarios (P7 matrix):
 *   S1  Catch-up after 3–7 d absence
 *   S2  Cramming (3 d in 1)
 *   S3  Irregular patterns (weekend-only etc.)
 *   S4  Exam in N days
 *   S5  "I have 15 minutes"
 *   S6  Absence > 1 week
 */

// ── Types ────────────────────────────────────────────────────────────────

export type AbsenceLevel = "none" | "short" | "long";

export interface AbsenceResult {
  level: AbsenceLevel;
  daysSince: number;
}

export interface SessionWindow {
  startedAt: Date;
  endedAt: Date | null;
}

export interface CramResult {
  isCramming: boolean;
  lessonsPerHour: number;
  ratio: number;
}

export type BudgetMinutes = 15 | 30 | 60 | null;

export interface JourneyStepLite {
  stepOrder: number;
  stepType: string;
  title: string;
  status: string;
  estMin?: number;
}

export interface DrillCardLite {
  id: string;
  topic: string;
  dueAt: Date;
  attempts: number;
  lastScore: number;
}

export interface ExamEvent {
  title: string;
  daysUntil: number;
}

export interface PlanItem {
  type: "lesson" | "srs_review" | "condensed_lesson" | "break" | "quiz";
  title: string;
  estMin: number;
  topic: string | null;
  source: "journey" | "srs" | "weak_topic" | "exam_prep" | "budget_fill";
  /** True when this is a rest reminder (horizon plans). */
  isBreak?: boolean;
}

export interface GeneratePlanParams {
  journeySteps: JourneyStepLite[];
  drillCardsDue: DrillCardLite[];
  weakTopics: string[];
  budgetMin: number;
  horizonDays?: number;
  examEvent?: ExamEvent;
  isCramming?: boolean;
}

export interface SrsScheduleResult {
  dueAt: Date;
  interval: number;
  ease: "again" | "hard" | "good" | "easy";
}

export type StudyScenario =
  | "catch_up"
  | "cramming"
  | "irregular"
  | "exam_prep"
  | "time_budget"
  | "long_absence"
  | "normal";

export interface ProactiveOffer {
  scenario: StudyScenario;
  copy: string;
  options: { label: string; value: string }[];
}

export interface TutorContextResult {
  activeScenario: StudyScenario;
  proactiveOffer: ProactiveOffer | null;
  contextSummary: string;
}

// ── Thresholds ───────────────────────────────────────────────────────────

const ABSENCE_SHORT_MIN = 3;
const ABSENCE_LONG_MIN = 8;
const CRAM_MULTIPLIER = 3;
const DEFAULT_BASELINE_PER_HOUR = 1.5;
const HORIZON_BLOCK_MIN = 120;
const HORIZON_BREAK_MIN = 15;
const SRS_BASE_INTERVAL = 7;

// ── 1a. detectAbsence ───────────────────────────────────────────────────

/**
 * Classify how long the learner has been away.
 *
 * - `none`  — active within the last 3 days
 * - `short` — 3–7 days (catch-up scenario S1)
 * - `long`  — 8+ days (diagnostic scenario S6)
 */
export function detectAbsence(
  lastActivityDate: Date | null,
  now: Date = new Date(),
): AbsenceResult {
  if (!lastActivityDate) {
    return { level: "none", daysSince: 0 };
  }
  const ms = now.getTime() - lastActivityDate.getTime();
  const daysSince = Math.floor(ms / 86_400_000);

  if (daysSince >= ABSENCE_LONG_MIN) return { level: "long", daysSince };
  if (daysSince >= ABSENCE_SHORT_MIN) return { level: "short", daysSince };
  return { level: "none", daysSince };
}

// ── 1b. detectCram ──────────────────────────────────────────────────────

/**
 * Detect intensive study bursts (scenario S2).
 *
 * Counts completed sessions in the last 24 h and compares the
 * lessons-per-hour rate against the personal baseline. Cramming is
 * flagged when the rate reaches `baseline * CRAM_MULTIPLIER`.
 */
export function detectCram(
  sessionsToday: SessionWindow[],
  baselinePerHour: number = DEFAULT_BASELINE_PER_HOUR,
  now: Date = new Date(),
): CramResult {
  const cutoff = new Date(now.getTime() - 24 * 3600_000);
  const recent = sessionsToday.filter((s) => s.startedAt >= cutoff);

  if (recent.length === 0) {
    return { isCramming: false, lessonsPerHour: 0, ratio: 0 };
  }

  // Total hours spanned (minimum 1h to avoid division by zero).
  const firstStart = recent.reduce(
    (min, s) => (s.startedAt < min ? s.startedAt : min),
    recent[0].startedAt,
  );
  const spanHours = Math.max(1, (now.getTime() - firstStart.getTime()) / 3600_000);
  const lessonsPerHour = recent.length / spanHours;
  const threshold = baselinePerHour * CRAM_MULTIPLIER;
  const ratio = lessonsPerHour / baselinePerHour;

  return {
    isCramming: lessonsPerHour >= threshold,
    lessonsPerHour: Math.round(lessonsPerHour * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
  };
}

// ── 1c. suggestBudget ───────────────────────────────────────────────────

/**
 * Recommend a time-budget default from recent session history.
 *
 * Picks the most-frequent budget bucket from the last 10 sessions.
 * Falls back to 30 min when there is no history.
 */
export function suggestBudget(
  sessionDurationsMin: number[],
): BudgetMinutes {
  if (sessionDurationsMin.length === 0) return 30;

  const buckets: Record<number, number> = { 15: 0, 30: 0, 60: 0 };
  const recent = sessionDurationsMin.slice(-10);

  for (const d of recent) {
    if (d <= 20) buckets[15]++;
    else if (d <= 45) buckets[30]++;
    else buckets[60]++;
  }

  const best = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  return Number(best[0]) as BudgetMinutes;
}

// ── 1d. generatePlan ────────────────────────────────────────────────────

/**
 * Build an ordered study plan that fits within the time budget.
 *
 * Scoring priority (higher = scheduled first):
 *   - SRS due cards        ×2 weight
 *   - Weak topics          ×1.5 weight
 *   - Exam proximity       bonus when exam < 7 d
 *   - Journey order        natural step sequence
 *
 * Constraints:
 *   - sum(estMin) <= budgetMin  (scenario S5 never overruns)
 *   - Horizon plans (S4) use 2 h blocks + breaks
 *   - Cram mode (S2) uses condensed lessons, skips optional
 */
export function generatePlan(params: GeneratePlanParams): PlanItem[] {
  const {
    journeySteps,
    drillCardsDue,
    weakTopics,
    budgetMin,
    horizonDays,
    examEvent,
    isCramming,
  } = params;

  // Score and collect candidate items.
  const candidates: (PlanItem & { score: number })[] = [];

  // 1) SRS due cards — highest priority (weight ×2).
  for (const card of drillCardsDue) {
    candidates.push({
      type: "srs_review",
      title: `Review: ${card.topic}`,
      estMin: 5,
      topic: card.topic,
      source: "srs",
      score: 2.0 + (card.attempts === 0 ? 0.5 : 0),
    });
  }

  // 2) Weak topics — ×1.5 weight.
  for (const topic of weakTopics) {
    // Avoid duplicating SRS cards on the same topic.
    const alreadySrs = drillCardsDue.some((c) => c.topic === topic);
    if (!alreadySrs) {
      candidates.push({
        type: "quiz",
        title: `Strengthen: ${topic}`,
        estMin: 10,
        topic,
        source: "weak_topic",
        score: 1.5,
      });
    }
  }

  // 3) Journey steps — pending lessons in order.
  const pending = journeySteps
    .filter((s) => s.status === "pending" || s.status === "active")
    .sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of pending) {
    const estMin = step.estMin ?? (isCramming ? 5 : 10);
    const type = isCramming ? "condensed_lesson" : "lesson";
    let score = 1.0;

    // Exam proximity bonus: bump journey items when exam < 7 d.
    if (examEvent && examEvent.daysUntil <= 7) {
      score += 0.5 * (1 - examEvent.daysUntil / 7);
    }

    candidates.push({
      type,
      title: step.title,
      estMin,
      topic: step.title,
      source: examEvent && examEvent.daysUntil <= 7 ? "exam_prep" : "journey",
      score,
    });
  }

  // Sort by score descending (greedy knapsack).
  candidates.sort((a, b) => b.score - a.score);

  // Fill the budget.
  const plan: PlanItem[] = [];
  let remaining = budgetMin;

  for (const c of candidates) {
    if (c.estMin > remaining) continue;
    plan.push(c);
    remaining -= c.estMin;
  }

  // Horizon mode (S4): wrap in 2 h blocks with breaks.
  if (horizonDays && horizonDays > 1) {
    return buildHorizonPlan(plan, horizonDays, budgetMin);
  }

  return plan;
}

/**
 * Wrap a flat plan into time-blocked days with breaks (scenario S4).
 * Each block is ≤ HORIZON_BLOCK_MIN with a HORIZON_BREAK_MIN rest after.
 */
function buildHorizonPlan(
  items: PlanItem[],
  days: number,
  totalBudgetMin: number,
): PlanItem[] {
  const perDayBudget = Math.floor(totalBudgetMin / days);
  const result: PlanItem[] = [];
  let dayUsed = 0;
  let dayRemaining = perDayBudget;

  for (const item of items) {
    // Need a break before starting a new day block?
    if (item.estMin > dayRemaining && dayUsed < days - 1) {
      // Insert break at end of current day.
      if (dayRemaining > 0 && dayRemaining < perDayBudget) {
        result.push({
          type: "break",
          title: "Break — stretch & hydrate",
          estMin: Math.min(HORIZON_BREAK_MIN, dayRemaining),
          topic: null,
          source: "budget_fill",
          isBreak: true,
        });
      }
      dayUsed++;
      dayRemaining = perDayBudget;
    }

    if (item.estMin <= dayRemaining) {
      result.push(item);
      dayRemaining -= item.estMin;
    }
  }

  return result;
}

// ── 1e. srsSchedule ─────────────────────────────────────────────────────

/**
 * Compute the next due date for a DrillCard using a simplified SM-2
 * inspired algorithm. Intervals scale with consecutive good scores.
 *
 * - again (score < 40):  1 day, reset streak
 * - hard  (score 40–69): 3 days
 * - good  (score 70–89): 7 days base, doubles on streak
 * - easy  (score 90+):   14 days base, doubles on streak
 */
export function srsSchedule(
  card: { attempts: number; lastScore: number },
  now: Date = new Date(),
): SrsScheduleResult {
  const score = card.lastScore;
  let ease: SrsScheduleResult["ease"];
  let baseInterval: number;

  if (score < 40) {
    ease = "again";
    baseInterval = 1;
  } else if (score < 70) {
    ease = "hard";
    baseInterval = 3;
  } else if (score < 90) {
    ease = "good";
    baseInterval = SRS_BASE_INTERVAL;
  } else {
    ease = "easy";
    baseInterval = 14;
  }

  // Consecutive mastery: double the interval for good/easy with streak.
  let interval = baseInterval;
  if ((ease === "good" || ease === "easy") && card.attempts >= 2) {
    const streakBonus = Math.min(card.attempts - 1, 3); // cap at ×8
    interval = baseInterval * Math.pow(2, streakBonus);
  }

  const dueAt = new Date(now.getTime() + interval * 86_400_000);
  return { dueAt, interval, ease };
}

// ── 1f. tutorContext ────────────────────────────────────────────────────

const SCENARIO_COPY: Record<StudyScenario, string> = {
  catch_up:
    "Welcome back! You missed a few lessons. Want to pick up where you left off, or should I give you a quick summary of what changed?",
  cramming:
    "You're on a roll! Just a heads-up — slowing down a little helps retention. Want me to condense the next topics for you?",
  irregular:
    "I noticed you tend to study on weekends. Want me to plan a weekend session that covers what you need?",
  exam_prep:
    "Your exam is coming up! Let me build a focused review plan targeting your weakest areas first.",
  time_budget:
    "Short on time? I can fit a quick review or micro-lesson into your window.",
  long_absence:
    "It's been a while — no worries, let's figure out where to pick up. A quick 10-question check can help me route you to the right spot.",
  normal: "",
};

/**
 * Build the tutor context for a given learner state.
 *
 * Returns the active scenario label, a proactive offer (copy + options)
 * when a scenario is detected, and a plain-text context summary for
 * the system prompt.
 */
export function tutorContext(input: {
  absence: AbsenceResult;
  cram: CramResult;
  hasExamSoon: boolean;
  budgetMin: number | null;
  courseName: string | null;
  streak: number;
  surface: string;
}): TutorContextResult {
  const { absence, cram, hasExamSoon, budgetMin, courseName, streak, surface } = input;

  // Determine active scenario (priority order).
  let scenario: StudyScenario = "normal";
  if (absence.level === "long") scenario = "long_absence";
  else if (absence.level === "short") scenario = "catch_up";
  else if (cram.isCramming) scenario = "cramming";
  else if (hasExamSoon) scenario = "exam_prep";
  else if (budgetMin !== null && budgetMin <= 15) scenario = "time_budget";

  const copy = SCENARIO_COPY[scenario];
  let proactiveOffer: ProactiveOffer | null = null;

  if (scenario !== "normal" && copy) {
    proactiveOffer = {
      scenario,
      copy,
      options: buildScenarioOptions(scenario),
    };
  }

  const parts: string[] = [];
  if (courseName) parts.push(`Course: ${courseName}`);
  parts.push(`Streak: ${streak}d`);
  parts.push(`Surface: ${surface}`);
  if (scenario !== "normal") parts.push(`Active scenario: ${scenario}`);
  if (absence.level !== "none") parts.push(`Absent ${absence.daysSince}d (${absence.level})`);
  if (cram.isCramming) parts.push(`Cramming: ${cram.lessonsPerHour} lessons/h (ratio ${cram.ratio}x)`);

  return {
    activeScenario: scenario,
    proactiveOffer,
    contextSummary: parts.join(" | "),
  };
}

function buildScenarioOptions(
  scenario: StudyScenario,
): { label: string; value: string }[] {
  switch (scenario) {
    case "catch_up":
      return [
        { label: "Resume where I left off", value: "resume" },
        { label: "Show what I missed", value: "what_i_missed" },
        { label: "Condensed plan (10 min)", value: "condensed" },
        { label: "Start from today", value: "start_today" },
      ];
    case "cramming":
      return [
        { label: "Condense next topics", value: "condense" },
        { label: "Keep going full speed", value: "full_speed" },
        { label: "Schedule a break", value: "break" },
      ];
    case "exam_prep":
      return [
        { label: "Build emergency plan", value: "emergency_plan" },
        { label: "Review weak topics", value: "weak_topics" },
        { label: "Practice quiz", value: "quiz" },
      ];
    case "long_absence":
      return [
        { label: "Take the diagnostic quiz", value: "diagnostic" },
        { label: "Jump back in where I was", value: "resume" },
        { label: "Start from the beginning", value: "restart" },
      ];
    case "time_budget":
      return [
        { label: "Quick review (5 min)", value: "quick_review" },
        { label: "Micro-lesson", value: "micro_lesson" },
        { label: "Quick quiz", value: "quick_quiz" },
      ];
    default:
      return [];
  }
}

// ── Cadence inference (used by DB wrapper) ───────────────────────────────

/**
 * Infer a learner's personal cadence (avg active days per week) from
 * their EngagementEvent history. Used to personalise absence thresholds.
 *
 * Pure function — caller provides the event dates.
 */
export function inferCadence(
  eventDates: Date[],
  now: Date = new Date(),
): number {
  if (eventDates.length < 2) return DEFAULT_BASELINE_PER_HOUR;

  const sorted = [...eventDates].sort((a, b) => a.getTime() - b.getTime());
  const spanDays = Math.max(
    1,
    (now.getTime() - sorted[0].getTime()) / 86_400_000,
  );
  const spanWeeks = Math.max(1, spanDays / 7);

  // Count distinct active days.
  const activeDays = new Set(
    sorted.map((d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    ),
  );

  return activeDays.size / spanWeeks;
}
