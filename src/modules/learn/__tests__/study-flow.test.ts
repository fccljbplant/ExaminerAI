/**
 * Study-Flow Engine — unit tests for all 6 P7 scenarios.
 *
 * Pure-function tests only (no DB). Each scenario builds fixture data
 * and asserts the engine output matches the spec.
 *
 * P7 matrix:
 *   S1  Catch-up after 3–7 d absence
 *   S2  Cramming (3 d in 1)
 *   S3  Irregular patterns (weekend-only)
 *   S4  Exam in N days
 *   S5  "I have 15 minutes"
 *   S6  Absence > 1 week
 */

import { describe, it, expect } from "vitest";
import {
  detectAbsence,
  detectCram,
  suggestBudget,
  generatePlan,
  srsSchedule,
  tutorContext,
  inferCadence,
  type GeneratePlanParams,
  type SessionWindow,
  type JourneyStepLite,
  type DrillCardLite,
} from "../lib/study-flow";

// ── Helpers ──────────────────────────────────────────────────────────────

function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 86_400_000);
}

function hoursAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 3600_000);
}

function makeSession(startedHoursAgo: number, durationMin: number = 30): SessionWindow {
  const startedAt = hoursAgo(startedHoursAgo);
  return { startedAt, endedAt: new Date(startedAt.getTime() + durationMin * 60_000) };
}

const NOW = new Date("2026-08-14T12:00:00Z");

// ── S1: Catch-up after 3–7 d absence ────────────────────────────────────

describe("S1 — Catch-up after 3–7 d absence", () => {
  it("detects short absence at 5 days", () => {
    const result = detectAbsence(daysAgo(5, NOW), NOW);
    expect(result.level).toBe("short");
    expect(result.daysSince).toBe(5);
  });

  it("detects short absence at 3 days (boundary)", () => {
    const result = detectAbsence(daysAgo(3, NOW), NOW);
    expect(result.level).toBe("short");
    expect(result.daysSince).toBe(3);
  });

  it("detects short absence at 7 days (boundary)", () => {
    const result = detectAbsence(daysAgo(7, NOW), NOW);
    expect(result.level).toBe("short");
    expect(result.daysSince).toBe(7);
  });

  it("generates a plan with catch-up options", () => {
    const steps: JourneyStepLite[] = [
      { stepOrder: 1, stepType: "slide", title: "Missed Lesson A", status: "pending", estMin: 10 },
      { stepOrder: 2, stepType: "slide", title: "Missed Lesson B", status: "pending", estMin: 10 },
      { stepOrder: 3, stepType: "slide", title: "Missed Lesson C", status: "pending", estMin: 10 },
    ];
    const params: GeneratePlanParams = {
      journeySteps: steps,
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 30,
    };
    const plan = generatePlan(params);
    // Plan should include the 3 missed lessons within budget.
    expect(plan.length).toBeGreaterThanOrEqual(3);
    const totalMin = plan.reduce((s, p) => s + p.estMin, 0);
    expect(totalMin).toBeLessThanOrEqual(30);
  });

  it("tutorContext offers catch-up scenario", () => {
    const ctx = tutorContext({
      absence: { level: "short", daysSince: 5 },
      cram: { isCramming: false, lessonsPerHour: 0, ratio: 0 },
      hasExamSoon: false,
      budgetMin: null,
      courseName: "HSE Safety",
      streak: 4,
      surface: "/learner",
    });
    expect(ctx.activeScenario).toBe("catch_up");
    expect(ctx.proactiveOffer).not.toBeNull();
    expect(ctx.proactiveOffer!.options.length).toBe(4);
    expect(ctx.contextSummary).toContain("Absent 5d");
  });
});

// ── S2: Cramming (3 d in 1) ─────────────────────────────────────────────

describe("S2 — Cramming detection", () => {
  it("flags cramming when rate >= 3x baseline", () => {
    // 3 sessions in 1 hour → 3 lessons/hour, baseline 1.5 → ratio 2x
    // Actually need 4.5 lessons/hour for 3x. Let's do 5 sessions in 1 hour.
    const sessions: SessionWindow[] = [
      makeSession(1, 10),
      makeSession(0.8, 10),
      makeSession(0.6, 10),
      makeSession(0.4, 10),
      makeSession(0.2, 10),
    ];
    const result = detectCram(sessions, 1.5, NOW);
    expect(result.isCramming).toBe(true);
    expect(result.ratio).toBeGreaterThanOrEqual(3);
  });

  it("does not flag normal pace", () => {
    const sessions: SessionWindow[] = [makeSession(3, 30), makeSession(1, 30)];
    const result = detectCram(sessions, 1.5, NOW);
    expect(result.isCramming).toBe(false);
  });

  it("returns zeros for empty sessions", () => {
    const result = detectCram([], 1.5, NOW);
    expect(result.isCramming).toBe(false);
    expect(result.lessonsPerHour).toBe(0);
    expect(result.ratio).toBe(0);
  });

  it("generates condensed plan when cramming", () => {
    const steps: JourneyStepLite[] = [
      { stepOrder: 1, stepType: "slide", title: "Topic A", status: "pending", estMin: 10 },
      { stepOrder: 2, stepType: "slide", title: "Topic B", status: "pending", estMin: 10 },
    ];
    const plan = generatePlan({
      journeySteps: steps,
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 30,
      isCramming: true,
    });
    // Cram mode: lessons should be condensed_lesson type.
    const lessonTypes = plan.filter((p) => p.source === "journey").map((p) => p.type);
    expect(lessonTypes.every((t) => t === "condensed_lesson")).toBe(true);
  });

  it("tutorContext offers cramming scenario", () => {
    const ctx = tutorContext({
      absence: { level: "none", daysSince: 0 },
      cram: { isCramming: true, lessonsPerHour: 5, ratio: 3.33 },
      hasExamSoon: false,
      budgetMin: null,
      courseName: "Web Dev",
      streak: 12,
      surface: "/learner/learn",
    });
    expect(ctx.activeScenario).toBe("cramming");
    expect(ctx.contextSummary).toContain("Cramming");
  });
});

// ── S3: Irregular patterns (weekend-only) ────────────────────────────────

describe("S3 — Irregular cadence inference", () => {
  it("infers weekend-only cadence from event dates", () => {
    // 3 weeks of Saturday-only activity.
    const dates: Date[] = [];
    for (let w = 0; w < 3; w++) {
      // Saturdays: 2026-08-01, 08-08, 08-13 (closest Saturdays)
      dates.push(new Date(`2026-08-${String(1 + w * 7).padStart(2, "0")}T10:00:00Z`));
    }
    const cadence = inferCadence(dates, NOW);
    // 3 active days over ~2 weeks = 1.5 days/week.
    expect(cadence).toBeGreaterThan(0);
    expect(cadence).toBeLessThanOrEqual(3);
  });

  it("returns default for insufficient data", () => {
    expect(inferCadence([], NOW)).toBe(1.5);
    expect(inferCadence([NOW], NOW)).toBe(1.5);
  });
});

// ── S4: Exam in N days ──────────────────────────────────────────────────

describe("S4 — Exam prep planning", () => {
  it("prioritizes weak topics when exam is close", () => {
    const steps: JourneyStepLite[] = [
      { stepOrder: 1, stepType: "slide", title: "Normal Topic", status: "pending", estMin: 10 },
    ];
    const plan = generatePlan({
      journeySteps: steps,
      drillCardsDue: [],
      weakTopics: ["Hazard Classification", "Permit Systems"],
      budgetMin: 60,
      examEvent: { title: "Final Exam", daysUntil: 3 },
    });
    // Weak topics should appear before normal journey items.
    const weakItems = plan.filter((p) => p.source === "weak_topic");
    expect(weakItems.length).toBe(2);
    // First items should be weak topics or SRS (higher score).
    expect(["weak_topic", "srs", "exam_prep"]).toContain(plan[0].source);
  });

  it("builds horizon plan with breaks for multi-day", () => {
    const steps: JourneyStepLite[] = Array.from({ length: 10 }, (_, i) => ({
      stepOrder: i + 1,
      stepType: "slide",
      title: `Lesson ${i + 1}`,
      status: "pending" as const,
      estMin: 15,
    }));
    const plan = generatePlan({
      journeySteps: steps,
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 240,
      horizonDays: 3,
      examEvent: { title: "Exam", daysUntil: 3 },
    });
    // Should contain break items.
    const breaks = plan.filter((p) => p.isBreak);
    expect(breaks.length).toBeGreaterThan(0);
  });

  it("tutorContext detects exam prep scenario", () => {
    const ctx = tutorContext({
      absence: { level: "none", daysSince: 0 },
      cram: { isCramming: false, lessonsPerHour: 0, ratio: 0 },
      hasExamSoon: true,
      budgetMin: null,
      courseName: "HSE Safety",
      streak: 7,
      surface: "/learner",
    });
    expect(ctx.activeScenario).toBe("exam_prep");
    expect(ctx.proactiveOffer!.options.some((o) => o.value === "emergency_plan")).toBe(true);
  });
});

// ── S5: "I have 15 minutes" ─────────────────────────────────────────────

describe("S5 — Time-budget plan never overruns", () => {
  it("respects 15-minute budget", () => {
    const steps: JourneyStepLite[] = [
      { stepOrder: 1, stepType: "slide", title: "Topic A", status: "pending", estMin: 10 },
      { stepOrder: 2, stepType: "slide", title: "Topic B", status: "pending", estMin: 10 },
      { stepOrder: 3, stepType: "slide", title: "Topic C", status: "pending", estMin: 10 },
    ];
    const cards: DrillCardLite[] = [
      { id: "c1", topic: "Topic A", dueAt: NOW, attempts: 2, lastScore: 60 },
    ];
    const plan = generatePlan({
      journeySteps: steps,
      drillCardsDue: cards,
      weakTopics: [],
      budgetMin: 15,
    });
    const totalMin = plan.reduce((s, p) => s + p.estMin, 0);
    expect(totalMin).toBeLessThanOrEqual(15);
  });

  it("respects 30-minute budget", () => {
    const steps: JourneyStepLite[] = Array.from({ length: 5 }, (_, i) => ({
      stepOrder: i + 1,
      stepType: "slide",
      title: `L${i + 1}`,
      status: "pending" as const,
      estMin: 10,
    }));
    const plan = generatePlan({
      journeySteps: steps,
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 30,
    });
    const totalMin = plan.reduce((s, p) => s + p.estMin, 0);
    expect(totalMin).toBeLessThanOrEqual(30);
  });

  it("suggests 15-min budget for short sessions", () => {
    expect(suggestBudget([10, 12, 15, 8, 14])).toBe(15);
  });

  it("suggests 30-min budget for medium sessions", () => {
    expect(suggestBudget([25, 30, 35, 28, 40])).toBe(30);
  });

  it("defaults to 30 when no history", () => {
    expect(suggestBudget([])).toBe(30);
  });

  it("tutorContext detects time_budget scenario", () => {
    const ctx = tutorContext({
      absence: { level: "none", daysSince: 0 },
      cram: { isCramming: false, lessonsPerHour: 0, ratio: 0 },
      hasExamSoon: false,
      budgetMin: 15,
      courseName: "Mobile Repair",
      streak: 2,
      surface: "/learner/study",
    });
    expect(ctx.activeScenario).toBe("time_budget");
  });
});

// ── S6: Absence > 1 week ────────────────────────────────────────────────

describe("S6 — Long absence (> 7 d)", () => {
  it("detects long absence at 10 days", () => {
    const result = detectAbsence(daysAgo(10, NOW), NOW);
    expect(result.level).toBe("long");
    expect(result.daysSince).toBe(10);
  });

  it("detects long absence at 8 days (boundary)", () => {
    const result = detectAbsence(daysAgo(8, NOW), NOW);
    expect(result.level).toBe("long");
    expect(result.daysSince).toBe(8);
  });

  it("no absence for null lastActivityDate (new learner)", () => {
    const result = detectAbsence(null, NOW);
    expect(result.level).toBe("none");
    expect(result.daysSince).toBe(0);
  });

  it("no absence for recent activity (1 day)", () => {
    const result = detectAbsence(daysAgo(1, NOW), NOW);
    expect(result.level).toBe("none");
  });

  it("tutorContext offers diagnostic for long absence", () => {
    const ctx = tutorContext({
      absence: { level: "long", daysSince: 10 },
      cram: { isCramming: false, lessonsPerHour: 0, ratio: 0 },
      hasExamSoon: false,
      budgetMin: null,
      courseName: "eBay Store Launch",
      streak: 0,
      surface: "/learner",
    });
    expect(ctx.activeScenario).toBe("long_absence");
    expect(ctx.proactiveOffer!.options.some((o) => o.value === "diagnostic")).toBe(true);
    expect(ctx.contextSummary).toContain("Absent 10d");
  });
});

// ── SRS scheduling ──────────────────────────────────────────────────────

describe("srsSchedule", () => {
  it("returns 1 day for failing scores (again)", () => {
    const result = srsSchedule({ attempts: 1, lastScore: 30 }, NOW);
    expect(result.ease).toBe("again");
    expect(result.interval).toBe(1);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + 1 * 86_400_000);
  });

  it("returns 3 days for hard scores", () => {
    const result = srsSchedule({ attempts: 1, lastScore: 55 }, NOW);
    expect(result.ease).toBe("hard");
    expect(result.interval).toBe(3);
  });

  it("returns 7 days base for good scores", () => {
    const result = srsSchedule({ attempts: 1, lastScore: 80 }, NOW);
    expect(result.ease).toBe("good");
    expect(result.interval).toBe(7);
  });

  it("returns 14 days base for easy scores", () => {
    const result = srsSchedule({ attempts: 1, lastScore: 95 }, NOW);
    expect(result.ease).toBe("easy");
    expect(result.interval).toBe(14);
  });

  it("doubles interval on consecutive mastery (good, 3 attempts)", () => {
    const result = srsSchedule({ attempts: 3, lastScore: 85 }, NOW);
    expect(result.ease).toBe("good");
    // base 7 * 2^(min(2,3)) = 7 * 4 = 28
    expect(result.interval).toBe(28);
  });

  it("caps streak bonus at ×8", () => {
    const result = srsSchedule({ attempts: 10, lastScore: 92 }, NOW);
    expect(result.ease).toBe("easy");
    // base 14 * 2^(min(9,3)) = 14 * 8 = 112
    expect(result.interval).toBe(112);
  });

  it("resets interval on low score regardless of attempts", () => {
    const result = srsSchedule({ attempts: 5, lastScore: 20 }, NOW);
    expect(result.ease).toBe("again");
    expect(result.interval).toBe(1);
  });
});

// ── Boundary / edge cases ────────────────────────────────────────────────

describe("Edge cases", () => {
  it("detectAbsence at exactly 2 days → none", () => {
    expect(detectAbsence(daysAgo(2, NOW), NOW).level).toBe("none");
  });

  it("generatePlan returns empty when budget is 0", () => {
    const plan = generatePlan({
      journeySteps: [{ stepOrder: 1, stepType: "slide", title: "A", status: "pending", estMin: 10 }],
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 0,
    });
    expect(plan).toEqual([]);
  });

  it("generatePlan skips completed journey steps", () => {
    const plan = generatePlan({
      journeySteps: [
        { stepOrder: 1, stepType: "slide", title: "Done", status: "completed", estMin: 10 },
        { stepOrder: 2, stepType: "slide", title: "Pending", status: "pending", estMin: 10 },
      ],
      drillCardsDue: [],
      weakTopics: [],
      budgetMin: 30,
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].title).toBe("Pending");
  });

  it("generatePlan avoids duplicating weak topics already in SRS", () => {
    const plan = generatePlan({
      journeySteps: [],
      drillCardsDue: [{ id: "c1", topic: "React", dueAt: NOW, attempts: 1, lastScore: 50 }],
      weakTopics: ["React"],
      budgetMin: 30,
    });
    const reactItems = plan.filter((p) => p.topic === "React");
    expect(reactItems).toHaveLength(1);
    expect(reactItems[0].source).toBe("srs");
  });
});
