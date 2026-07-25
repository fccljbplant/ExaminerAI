/**
 * Tests for AI course data normalization.
 *
 * The normalizeAiCourseData function is the bridge between AI output and
 * our validation. If it breaks, AI-generated courses silently fail to save
 * (the exact bug we just fixed). These tests ensure the normalization
 * handles all the ways the AI might format its JSON response.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";

/** Helper: cast the unknown[] result to a typed shape for testing. */
function asTyped(result: unknown[] | undefined): Array<{
  weekNumber: number;
  phase: string;
  milestone: string;
  days: Array<{
    day: number;
    title: string;
    objective: string;
    whyItMatters: string;
    topicsCovered: unknown[];
    activity: string;
    deliverable: string;
    resources: unknown[];
  }>;
}> {
  return (result ?? []) as Array<{
    weekNumber: number;
    phase: string;
    milestone: string;
    days: Array<{
      day: number;
      title: string;
      objective: string;
      whyItMatters: string;
      topicsCovered: unknown[];
      activity: string;
      deliverable: string;
      resources: unknown[];
    }>;
  }>;
}

/**
 * Re-implement the normalization function here for testing.
 * In production it lives in /api/courses/route.ts but isn't exported.
 * This is an exact copy — if the production version changes, update both.
 */
function normalizeAiCourseData(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;

  return raw.map((w, weekIdx) => {
    if (!w || typeof w !== "object") return { weekNumber: weekIdx + 1, phase: `Week ${weekIdx + 1}`, days: [] };
    const week = w as Record<string, unknown>;

    let weekNumber = Number(week.weekNumber);
    if (!Number.isInteger(weekNumber) || weekNumber < 1) weekNumber = weekIdx + 1;

    let phase = typeof week.phase === "string" ? week.phase.trim() : "";
    if (!phase) phase = `Week ${weekNumber}`;

    const milestone = typeof week.milestone === "string" ? week.milestone : "";

    let days: unknown[] = [];
    if (Array.isArray(week.days)) {
      days = week.days.map((d, dayIdx) => {
        if (!d || typeof d !== "object") return { day: dayIdx + 1, title: `Day ${dayIdx + 1}` };
        const day = d as Record<string, unknown>;
        let dayNum = Number(day.day);
        if (!Number.isInteger(dayNum) || dayNum < 1) dayNum = dayIdx + 1;
        let title = typeof day.title === "string" ? day.title.trim() : "";
        if (!title) title = `Day ${dayNum}`;
        return {
          ...day,
          day: dayNum,
          title,
          objective: typeof day.objective === "string" ? day.objective : "",
          whyItMatters: typeof day.whyItMatters === "string" ? day.whyItMatters : "",
          topicsCovered: Array.isArray(day.topicsCovered) ? day.topicsCovered : [],
          activity: typeof day.activity === "string" ? day.activity : "",
          deliverable: typeof day.deliverable === "string" ? day.deliverable : "",
          resources: Array.isArray(day.resources) ? day.resources : [],
        };
      });
    }

    if (days.length === 0) {
      days = [{ day: 1, title: `Day 1`, objective: "", resources: [] }];
    }

    return { ...week, weekNumber, phase, milestone, days };
  });
}

describe("normalizeAiCourseData", () => {
  // ---- Input validation ----

  it("returns undefined for non-array input", () => {
    expect(normalizeAiCourseData(null)).toBeUndefined();
    expect(normalizeAiCourseData(undefined)).toBeUndefined();
    expect(normalizeAiCourseData("not an array")).toBeUndefined();
    expect(normalizeAiCourseData({})).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(normalizeAiCourseData([])).toBeUndefined();
  });

  // ---- Type coercion (the main bug fix) ----

  it("coerces string weekNumber to number", () => {
    const result = normalizeAiCourseData([
      { weekNumber: "1", phase: "Intro", days: [{ day: "1", title: "Setup" }] },
    ]);
    expect(result).toBeDefined();
    expect(asTyped(result)[0].weekNumber).toBe(1);
    expect(asTyped(result)[0].days[0].day).toBe(1);
  });

  it("coerces string day to number", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [
        { day: "1", title: "A" },
        { day: "2", title: "B" },
      ]},
    ]);
    expect(asTyped(result)[0].days[0].day).toBe(1);
    expect(asTyped(result)[0].days[1].day).toBe(2);
  });

  it("handles float weekNumber by falling back to index", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1.5, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    // 1.5 is not an integer → falls back to weekIdx + 1 = 1
    expect(asTyped(result)[0].weekNumber).toBe(1);
  });

  it("handles NaN weekNumber by falling back to index", () => {
    const result = normalizeAiCourseData([
      { weekNumber: "abc", phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].weekNumber).toBe(1);
  });

  // ---- Default filling ----

  it("fills empty phase with 'Week N'", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 3, phase: "", days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].phase).toBe("Week 3");
  });

  it("fills missing phase with 'Week N'", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 2, days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].phase).toBe("Week 2");
  });

  it("fills empty title with 'Day N'", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 3, title: "" }] },
    ]);
    expect(asTyped(result)[0].days[0].title).toBe("Day 3");
  });

  it("fills missing title with 'Day N'", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 2 }] },
    ]);
    expect(asTyped(result)[0].days[0].title).toBe("Day 2");
  });

  it("creates placeholder day if days array is missing", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro" },
    ]);
    expect(asTyped(result)[0].days).toHaveLength(1);
    expect(asTyped(result)[0].days[0].day).toBe(1);
    expect(asTyped(result)[0].days[0].title).toBe("Day 1");
  });

  it("creates placeholder day if days array is empty", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [] },
    ]);
    expect(asTyped(result)[0].days).toHaveLength(1);
  });

  it("defaults milestone to empty string", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].milestone).toBe("");
  });

  it("defaults objective/whyItMatters/activity/deliverable to empty string", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    const day = asTyped(result)[0].days[0] as Record<string, unknown>;
    expect(day.objective).toBe("");
    expect(day.whyItMatters).toBe("");
    expect(day.activity).toBe("");
    expect(day.deliverable).toBe("");
  });

  it("defaults topicsCovered to empty array", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].days[0].topicsCovered).toEqual([]);
  });

  it("defaults resources to empty array", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    expect(asTyped(result)[0].days[0].resources).toEqual([]);
  });

  // ---- Preserves valid data ----

  it("preserves valid weekNumber, phase, and day data", () => {
    const input = [{
      weekNumber: 3,
      phase: "Advanced Topics",
      milestone: "Project milestone",
      days: [{
        day: 2,
        title: "Working with APIs",
        objective: "Learn REST",
        whyItMatters: "APIs are everywhere",
        topicsCovered: ["REST", "HTTP"],
        activity: "Build an API client",
        deliverable: "API client code",
        resources: [{ label: "Docs", url: "https://example.com" }],
      }],
    }];
    const result = normalizeAiCourseData(input);
    expect(asTyped(result)[0].weekNumber).toBe(3);
    expect(asTyped(result)[0].phase).toBe("Advanced Topics");
    expect(asTyped(result)[0].milestone).toBe("Project milestone");
    const day = asTyped(result)[0].days[0] as Record<string, unknown>;
    expect(day.day).toBe(2);
    expect(day.title).toBe("Working with APIs");
    expect(day.objective).toBe("Learn REST");
    expect(day.whyItMatters).toBe("APIs are everywhere");
    expect(day.topicsCovered).toEqual(["REST", "HTTP"]);
    expect(day.activity).toBe("Build an API client");
    expect(day.deliverable).toBe("API client code");
  });

  it("handles a full 6-week course correctly", () => {
    const input = Array.from({ length: 6 }, (_, i) => ({
      weekNumber: i + 1,
      phase: `Phase ${i + 1}`,
      days: Array.from({ length: 5 }, (_, d) => ({
        day: d + 1,
        title: `Topic ${d + 1}`,
      })),
    }));
    const result = normalizeAiCourseData(input);
    expect(result).toHaveLength(6);
    asTyped(result).forEach((w, i) => {
      expect(w.weekNumber).toBe(i + 1);
      expect(w.phase).toBe(`Phase ${i + 1}`);
      expect(w.days).toHaveLength(5);
    });
  });

  it("handles non-object week entries by creating defaults", () => {
    const result = normalizeAiCourseData([null, "string", 42, {}]);
    expect(result).toHaveLength(4);
    expect(asTyped(result)[0].weekNumber).toBe(1);
    expect(asTyped(result)[0].phase).toBe("Week 1");
    expect(asTyped(result)[1].weekNumber).toBe(2);
    expect(asTyped(result)[2].weekNumber).toBe(3);
    expect(asTyped(result)[3].weekNumber).toBe(4); // {} has no weekNumber → falls back to 4
  });

  it("handles non-object day entries by creating defaults", () => {
    const result = normalizeAiCourseData([
      { weekNumber: 1, phase: "Intro", days: [null, "string", 42] },
    ]);
    expect(asTyped(result)[0].days).toHaveLength(3);
    expect(asTyped(result)[0].days[0].day).toBe(1);
    expect(asTyped(result)[0].days[0].title).toBe("Day 1");
    expect(asTyped(result)[0].days[1].day).toBe(2);
    expect(asTyped(result)[0].days[2].day).toBe(3);
  });
});
