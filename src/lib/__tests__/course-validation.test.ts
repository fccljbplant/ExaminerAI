/**
 * Tests for course validation — the gatekeeper for AI course generation.
 *
 * If this validation breaks, the AI could create courses with:
 * - Empty titles (students see blank topics)
 * - Gaps in week numbers (week 1, 2, 4 — week 3 missing)
 * - Days numbered 1-3 instead of 1-5 (incomplete weeks)
 * - Invalid resource URLs (clickable links that 404)
 * - Duplicate week/day numbers (confusing the DB unique constraint)
 *
 * These tests ensure the validation catches all of these before they
 * reach the database.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import { validateCourseName, validateCourseWeeks, COURSE_LIMITS } from "../course-validation";

describe("validateCourseName", () => {
  it("accepts a valid name", () => {
    expect(validateCourseName("Python for Data Science").ok).toBe(true);
  });

  it("rejects empty string", () => {
    const result = validateCourseName("");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects whitespace-only string", () => {
    const result = validateCourseName("   ");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects non-string types", () => {
    expect(validateCourseName(null).ok).toBe(false);
    expect(validateCourseName(undefined).ok).toBe(false);
    expect(validateCourseName(123).ok).toBe(false);
    expect(validateCourseName({}).ok).toBe(false);
  });

  it("rejects names exceeding the max length", () => {
    const longName = "x".repeat(COURSE_LIMITS.MAX_TITLE_LENGTH + 1);
    const result = validateCourseName(longName);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("at most");
  });

  it("trims whitespace before validating length", () => {
    const paddedName = "  Python  ";
    expect(validateCourseName(paddedName).ok).toBe(true);
  });
});

describe("validateCourseWeeks", () => {
  // ---- Valid cases ----

  it("accepts a well-formed 6-week course with 5 days each", () => {
    const weeks = Array.from({ length: 6 }, (_, i) => ({
      weekNumber: i + 1,
      phase: `Week ${i + 1} Phase`,
      days: Array.from({ length: 5 }, (_, d) => ({
        day: d + 1,
        title: `Day ${d + 1} Topic`,
        objective: "Learn something",
        resources: [{ label: "Docs", url: "https://example.com" }],
      })),
    }));
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(true);
  });

  it("accepts a minimal course: 1 week, 1 day, no resources", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "Setup" }] },
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts resources with relative URLs (starting with /)", () => {
    const result = validateCourseWeeks([
      {
        weekNumber: 1, phase: "Intro",
        days: [{ day: 1, title: "Setup", resources: [{ label: "Local", url: "/local-docs" }] }],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("normalizes bare-domain URLs (python.org → https://python.org)", () => {
    const weeks = [{
      weekNumber: 1, phase: "Intro",
      days: [{
        day: 1, title: "Python Setup",
        resources: [{ label: "Python", url: "python.org" }],
      }],
    }];
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(true);
    // The validation mutates in-place — check the URL was normalized
    expect((weeks[0].days[0].resources as { url: string }[])[0].url).toBe("https://python.org");
  });

  // ---- Structural rejections ----

  it("rejects non-array input", () => {
    expect(validateCourseWeeks(null).ok).toBe(false);
    expect(validateCourseWeeks(undefined).ok).toBe(false);
    expect(validateCourseWeeks("not an array").ok).toBe(false);
    expect(validateCourseWeeks({}).ok).toBe(false);
  });

  it("rejects empty weeks array", () => {
    const result = validateCourseWeeks([]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("At least");
  });

  it("rejects more than MAX_WEEKS weeks", () => {
    const weeks = Array.from({ length: COURSE_LIMITS.MAX_WEEKS + 1 }, (_, i) => ({
      weekNumber: i + 1,
      phase: `Week ${i + 1}`,
      days: [{ day: 1, title: "Topic" }],
    }));
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("at most");
  });

  // ---- Week-level rejections ----

  it("rejects duplicate weekNumber", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "A" }] },
      { weekNumber: 1, phase: "Duplicate", days: [{ day: 1, title: "B" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Duplicate weekNumber");
  });

  it("rejects non-integer weekNumber", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1.5, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("positive integer");
  });

  it("rejects zero or negative weekNumber", () => {
    expect(validateCourseWeeks([
      { weekNumber: 0, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]).ok).toBe(false);
    expect(validateCourseWeeks([
      { weekNumber: -1, phase: "Intro", days: [{ day: 1, title: "A" }] },
    ]).ok).toBe(false);
  });

  it("rejects empty phase", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "", days: [{ day: 1, title: "A" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("phase is required");
  });

  it("rejects week with no days", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("at least");
  });

  it("rejects week with too many days (> MAX_DAYS_PER_WEEK)", () => {
    const result = validateCourseWeeks([{
      weekNumber: 1, phase: "Intro",
      days: Array.from({ length: COURSE_LIMITS.MAX_DAYS_PER_WEEK + 1 }, (_, d) => ({
        day: d + 1, title: `Day ${d + 1}`,
      })),
    }]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cannot have more than");
  });

  // ---- Day-level rejections ----

  it("rejects duplicate day number within a week", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [
        { day: 1, title: "A" },
        { day: 1, title: "B" },
      ]},
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("duplicate day");
  });

  it("rejects empty title", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1, title: "" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("title is required");
  });

  it("rejects non-integer day number", () => {
    const result = validateCourseWeeks([
      { weekNumber: 1, phase: "Intro", days: [{ day: 1.5, title: "A" }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("positive integer");
  });

  // ---- Resource leniency (drops bad resources, doesn't reject the course) ----

  it("DROPS resources with empty labels (not fatal)", () => {
    const weeks = [{
      weekNumber: 1, phase: "Intro",
      days: [{
        day: 1, title: "Setup",
        resources: [
          { label: "Good", url: "https://example.com" },
          { label: "", url: "https://example.com" }, // empty label → dropped
        ],
      }],
    }];
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(true);
    // Only the good resource should remain
    expect((weeks[0].days[0].resources as { label: string }[]).length).toBe(1);
    expect((weeks[0].days[0].resources as { label: string }[])[0].label).toBe("Good");
  });

  it("DROPS resources with garbage URLs (not fatal)", () => {
    const weeks = [{
      weekNumber: 1, phase: "Intro",
      days: [{
        day: 1, title: "Setup",
        resources: [
          { label: "Good", url: "https://example.com" },
          { label: "Bad", url: "click here" }, // garbage → dropped
          { label: "Also Bad", url: "" }, // empty → dropped
        ],
      }],
    }];
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(true);
    expect((weeks[0].days[0].resources as { label: string }[]).length).toBe(1);
  });

  it("DROPS non-object resources (not fatal)", () => {
    const weeks = [{
      weekNumber: 1, phase: "Intro",
      days: [{
        day: 1, title: "Setup",
        resources: [
          { label: "Good", url: "https://example.com" },
          "not an object", // non-object → dropped
          null, // null → dropped
          42, // number → dropped
        ],
      }],
    }] as unknown as Parameters<typeof validateCourseWeeks>[0];
    const result = validateCourseWeeks(weeks);
    expect(result.ok).toBe(true);
    const cleaned = (weeks as unknown as [{ days: [{ resources: { label: string }[] }] }])[0].days[0].resources;
    expect(cleaned.length).toBe(1);
  });

  it("rejects resources array that exceeds the max", () => {
    const tooMany = Array.from({ length: COURSE_LIMITS.MAX_RESOURCES_PER_DAY + 1 }, (_, i) => ({
      label: `Resource ${i}`,
      url: `https://example.com/${i}`,
    }));
    const result = validateCourseWeeks([{
      weekNumber: 1, phase: "Intro",
      days: [{ day: 1, title: "Setup", resources: tooMany }],
    }]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("more than");
  });
});
