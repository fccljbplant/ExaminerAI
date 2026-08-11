/**
 * Tests for grading + course-topic helpers.
 *
 * These functions are used everywhere — scoreToGrade determines the
 * certificate grade + report card grade, getBootcampDayNumber determines
 * which curriculum topic a student sees today, isRestDay controls the
 * rest-day UX. A regression in any of these would silently break the
 * student experience.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import { scoreToGrade, gradeColor } from "../constants";
import {
  getBootcampDayNumber,
  getBootcampDayLabel,
  isRestDay,
  getRestDayLabel,
  getWeekTopics,
  getWeekPhase,
  getWeekTopicTitles,
  WEEKLY_TOPICS,
} from "../course-topics";

// ============================================================
// scoreToGrade — the grading scale used for certificates + report cards
// ============================================================
describe("scoreToGrade", () => {
  it("returns 'A' for scores 90-100", () => {
    expect(scoreToGrade(100)).toBe("A");
    expect(scoreToGrade(95)).toBe("A");
    expect(scoreToGrade(90)).toBe("A");
  });

  it("returns 'B' for scores 80-89", () => {
    expect(scoreToGrade(89)).toBe("B");
    expect(scoreToGrade(85)).toBe("B");
    expect(scoreToGrade(80)).toBe("B");
  });

  it("returns 'C' for scores 70-79", () => {
    expect(scoreToGrade(79)).toBe("C");
    expect(scoreToGrade(75)).toBe("C");
    expect(scoreToGrade(70)).toBe("C");
  });

  it("returns 'D' for scores 60-69", () => {
    expect(scoreToGrade(69)).toBe("D");
    expect(scoreToGrade(65)).toBe("D");
    expect(scoreToGrade(60)).toBe("D");
  });

  it("returns 'F' for scores below 60", () => {
    expect(scoreToGrade(59)).toBe("F");
    expect(scoreToGrade(30)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });

  it("handles edge cases at boundaries", () => {
    expect(scoreToGrade(90)).toBe("A"); // exactly 90 → A
    expect(scoreToGrade(89)).toBe("B"); // just below 90 → B
    expect(scoreToGrade(60)).toBe("D"); // exactly 60 → D
    expect(scoreToGrade(59)).toBe("F"); // just below 60 → F
  });
});

// ============================================================
// gradeColor — returns Tailwind text color class for a grade
// ============================================================
describe("gradeColor", () => {
  it("returns sage (growth) for grade A", () => {
    expect(gradeColor("A")).toContain("growth-sage");
  });

  it("returns sage (growth) for grade B", () => {
    expect(gradeColor("B")).toContain("growth-sage");
  });

  it("returns amber (growth) for grade C", () => {
    expect(gradeColor("C")).toContain("growth-amber");
  });

  it("returns destructive for grade D", () => {
    expect(gradeColor("D")).toContain("destructive");
  });

  it("returns destructive for grade F", () => {
    expect(gradeColor("F")).toContain("destructive");
  });

  it("returns destructive for unknown grades", () => {
    expect(gradeColor("X")).toContain("destructive");
    expect(gradeColor("")).toContain("destructive");
  });
});

// ============================================================
// getBootcampDayNumber — maps JS day-of-week to bootcamp day 1-7
// C4-fix: now supports 6/7-day courses (Sunday=1, Monday=2, ..., Saturday=7)
// ============================================================
describe("getBootcampDayNumber", () => {
  it("maps Monday (1) → 2", () => {
    const monday = new Date("2026-07-20"); // a Monday
    expect(getBootcampDayNumber(monday)).toBe(2);
  });

  it("maps Tuesday (2) → 3", () => {
    const tuesday = new Date("2026-07-21");
    expect(getBootcampDayNumber(tuesday)).toBe(3);
  });

  it("maps Wednesday (3) → 4", () => {
    const wednesday = new Date("2026-07-22");
    expect(getBootcampDayNumber(wednesday)).toBe(4);
  });

  it("maps Thursday (4) → 5", () => {
    const thursday = new Date("2026-07-23");
    expect(getBootcampDayNumber(thursday)).toBe(5);
  });

  it("maps Friday (5) → 6", () => {
    const friday = new Date("2026-07-24");
    expect(getBootcampDayNumber(friday)).toBe(6);
  });

  it("maps Saturday (6) → 7", () => {
    const saturday = new Date("2026-07-25");
    expect(getBootcampDayNumber(saturday)).toBe(7);
  });

  it("maps Sunday (0) → 1", () => {
    const sunday = new Date("2026-07-19");
    expect(getBootcampDayNumber(sunday)).toBe(1);
  });

  it("accepts a raw day-of-week number instead of a Date", () => {
    expect(getBootcampDayNumber(0)).toBe(1); // Sunday → 1
    expect(getBootcampDayNumber(1)).toBe(2); // Monday → 2
    expect(getBootcampDayNumber(5)).toBe(6); // Friday → 6
    expect(getBootcampDayNumber(6)).toBe(7); // Saturday → 7
  });
});

// ============================================================
// getBootcampDayLabel — human-readable day name
// ============================================================
describe("getBootcampDayLabel", () => {
  it("returns day names for 1-5", () => {
    expect(getBootcampDayLabel(1)).toBe("Monday");
    expect(getBootcampDayLabel(2)).toBe("Tuesday");
    expect(getBootcampDayLabel(3)).toBe("Wednesday");
    expect(getBootcampDayLabel(4)).toBe("Thursday");
    expect(getBootcampDayLabel(5)).toBe("Friday");
  });

  it("returns 'Day N' for out-of-range numbers", () => {
    expect(getBootcampDayLabel(0)).toBe("Day 0");
    expect(getBootcampDayLabel(6)).toBe("Day 6");
    expect(getBootcampDayLabel(99)).toBe("Day 99");
  });
});

// ============================================================
// isRestDay — Saturday or Sunday
// ============================================================
describe("isRestDay", () => {
  it("returns true for Saturday", () => {
    const saturday = new Date("2026-07-25"); // Saturday
    expect(isRestDay(saturday)).toBe(true);
  });

  it("returns true for Sunday", () => {
    const sunday = new Date("2026-07-19"); // Sunday
    expect(isRestDay(sunday)).toBe(true);
  });

  it("returns false for weekdays", () => {
    expect(isRestDay(new Date("2026-07-20"))).toBe(false); // Monday
    expect(isRestDay(new Date("2026-07-21"))).toBe(false); // Tuesday
    expect(isRestDay(new Date("2026-07-22"))).toBe(false); // Wednesday
    expect(isRestDay(new Date("2026-07-23"))).toBe(false); // Thursday
    expect(isRestDay(new Date("2026-07-24"))).toBe(false); // Friday
  });
});

// ============================================================
// getRestDayLabel — returns the rest day name or empty string
// ============================================================
describe("getRestDayLabel", () => {
  it("returns 'Saturday' for Saturday", () => {
    const saturday = new Date("2026-07-25");
    expect(getRestDayLabel(saturday)).toBe("Saturday");
  });

  it("returns 'Sunday' for Sunday", () => {
    const sunday = new Date("2026-07-19");
    expect(getRestDayLabel(sunday)).toBe("Sunday");
  });

  it("returns empty string for weekdays", () => {
    const wednesday = new Date("2026-07-22");
    expect(getRestDayLabel(wednesday)).toBe("");
  });
});

// ============================================================
// Course topics — the default 6-week curriculum
// ============================================================
describe("WEEKLY_TOPICS", () => {
  it("has exactly 6 weeks", () => {
    expect(WEEKLY_TOPICS).toHaveLength(6);
  });

  it("has week numbers 1-6 in order", () => {
    WEEKLY_TOPICS.forEach((w, i) => {
      expect(w.week).toBe(i + 1);
    });
  });

  it("each week has a non-empty phase", () => {
    WEEKLY_TOPICS.forEach(w => {
      expect(w.phase).toBeTruthy();
      expect(w.phase.length).toBeGreaterThan(0);
    });
  });

  it("each week has 5 daily topics", () => {
    WEEKLY_TOPICS.forEach(w => {
      expect(w.topics).toHaveLength(5);
    });
  });

  it("each topic has a non-empty title + objective", () => {
    WEEKLY_TOPICS.forEach(w => {
      w.topics.forEach(t => {
        expect(t.title).toBeTruthy();
        expect(t.objective).toBeTruthy();
      });
    });
  });
});

describe("getWeekTopics", () => {
  it("returns 5 topics for week 1", () => {
    expect(getWeekTopics(1)).toHaveLength(5);
  });

  it("returns 5 topics for week 6", () => {
    expect(getWeekTopics(6)).toHaveLength(5);
  });

  it("returns empty array for invalid week", () => {
    expect(getWeekTopics(0)).toHaveLength(0);
    expect(getWeekTopics(7)).toHaveLength(0);
    expect(getWeekTopics(-1)).toHaveLength(0);
  });
});

describe("getWeekPhase", () => {
  it("returns the phase for week 1", () => {
    const phase = getWeekPhase(1);
    expect(phase).toBeTruthy();
    expect(typeof phase).toBe("string");
  });

  it("returns the phase for week 6", () => {
    const phase = getWeekPhase(6);
    expect(phase).toBeTruthy();
  });

  it("returns 'Week N' for invalid week", () => {
    expect(getWeekPhase(0)).toBe("Week 0");
    expect(getWeekPhase(7)).toBe("Week 7");
  });
});

describe("getWeekTopicTitles", () => {
  it("returns 5 title strings for week 1", () => {
    const titles = getWeekTopicTitles(1);
    expect(titles).toHaveLength(5);
    titles.forEach(t => expect(typeof t).toBe("string"));
  });

  it("returns empty array for invalid week", () => {
    expect(getWeekTopicTitles(0)).toHaveLength(0);
    expect(getWeekTopicTitles(99)).toHaveLength(0);
  });
});
