import { describe, expect, it } from "vitest";
import {
  calculateAttentionScore,
  calculateTaskProgress,
  canViewLearnerSupportSignals,
  getAuthorizedStudentCourseIds,
  resolveAuthorizedCourseSelection,
  toDailyLogPayload,
} from "./student-detail-visibility";

describe("instructor student-detail visibility", () => {

  it("intersects staff course access with the learner's enrolments", () => {
    expect(
      getAuthorizedStudentCourseIds(
        ["course-a", "course-b", "course-a"],
        ["course-b", "course-c"],
      ),
    ).toEqual(["course-b"]);
  });

  it("does not authorise a learner course the staff member does not teach or administer", () => {
    expect(getAuthorizedStudentCourseIds(["course-a"], ["course-b"])).toEqual([]);
  });

  it("returns each shared course once when both sides have duplicates", () => {
    expect(
      getAuthorizedStudentCourseIds(
        ["course-a", "course-b", "course-b"],
        ["course-a", "course-a", "course-b"],
      ),
    ).toEqual(["course-a", "course-b"]);
  });

  it("auto-selects the only shared course", () => {
    expect(resolveAuthorizedCourseSelection(["course-a"], null)).toEqual({
      kind: "selected",
      courseId: "course-a",
    });
  });

  it("requires an explicit choice when multiple courses are shared", () => {
    expect(resolveAuthorizedCourseSelection(["course-a", "course-b"], null)).toEqual({
      kind: "selection_required",
    });
  });

  it("accepts only an explicitly selected shared course", () => {
    expect(resolveAuthorizedCourseSelection(["course-a", "course-b"], "course-b")).toEqual({
      kind: "selected",
      courseId: "course-b",
    });
  });

  it("denies an unassigned or non-shared course selection", () => {
    expect(resolveAuthorizedCourseSelection(["course-a"], "course-b")).toEqual({
      kind: "forbidden",
    });
    expect(resolveAuthorizedCourseSelection([], null)).toEqual({ kind: "none" });
  });

  it("limits learner support indicators to instructors", () => {
    expect(canViewLearnerSupportSignals("instructor")).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", true, false)).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", false, true)).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", true, true)).toBe(true);
    expect(canViewLearnerSupportSignals("org_admin", true, true)).toBe(false);
    expect(canViewLearnerSupportSignals("platform_admin", true, true)).toBe(false);
  });

  it("treats progress as unavailable when there are no assigned tasks", () => {
    expect(calculateTaskProgress(0, 0)).toBeNull();
  });

  it("calculates genuine zero and non-zero progress from assigned tasks", () => {
    expect(calculateTaskProgress(4, 0)).toBe(0);
    expect(calculateTaskProgress(4, 2)).toBe(50);
  });

  it("treats attention as unavailable when no activity or scored tests exist", () => {
    expect(calculateAttentionScore(null, [], new Date("2026-11-10T12:00:00.000Z"))).toEqual({
      score: null,
      reasons: [],
    });
  });

  it("returns a genuine zero when available evidence has no attention indicators", () => {
    expect(
      calculateAttentionScore(
        new Date("2026-11-10T10:00:00.000Z"),
        [85, 82],
        new Date("2026-11-10T12:00:00.000Z"),
      ),
    ).toEqual({ score: 0, reasons: [] });
  });

  it("scores inactivity and low performance only when those evidence sources exist", () => {
    expect(
      calculateAttentionScore(
        new Date("2026-11-07T12:00:00.000Z"),
        [50],
        new Date("2026-11-10T12:00:00.000Z"),
      ),
    ).toEqual({
      score: 55,
      reasons: ["Inactive 3 days", "Last test 50%"],
    });
  });

  it("does not invent a test signal when only activity evidence exists", () => {
    expect(
      calculateAttentionScore(
        new Date("2026-11-08T12:00:00.000Z"),
        [],
        new Date("2026-11-10T12:00:00.000Z"),
      ),
    ).toEqual({ score: 15, reasons: ["Inactive 2 days"] });
  });

  it("returns a genuine declining-score signal without inventing inactivity", () => {
    expect(
      calculateAttentionScore(null, [90, 70], new Date("2026-11-10T12:00:00.000Z")),
    ).toEqual({ score: 15, reasons: ["Test scores declining"] });
  });

  it("returns attendance dates without confidence for organisation admins", () => {
    const payload = toDailyLogPayload(
      { date: new Date("2026-11-09T10:00:00.000Z"), confidence: 42 },
      false,
    );

    expect(payload).toEqual({ date: "2026-11-09" });
    expect(payload).not.toHaveProperty("confidence");
  });

  it("preserves confidence data for the learner's instructor", () => {
    expect(
      toDailyLogPayload(
        { date: new Date("2026-11-09T10:00:00.000Z"), confidence: 42 },
        true,
      ),
    ).toEqual({ date: "2026-11-09", confidence: 42 });
  });
});
