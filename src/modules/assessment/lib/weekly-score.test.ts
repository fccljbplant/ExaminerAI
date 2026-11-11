import { describe, expect, it } from "vitest";
import { getCompleteWeeklyScorePercent, getWeeklyScorePercent } from "./weekly-score";

describe("getCompleteWeeklyScorePercent", () => {
  it("converts a complete set of valid scores to a percentage", () => {
    expect(getCompleteWeeklyScorePercent([{ score: 1 }, { score: 0.5 }, { score: 0 }], 3)).toBe(50);
  });

  it("returns unavailable when any saved answer or score is missing", () => {
    expect(getCompleteWeeklyScorePercent([{ score: 1 }, null], 2)).toBeNull();
    expect(getCompleteWeeklyScorePercent([{ score: 1 }], 2)).toBeNull();
  });

  it("returns unavailable for non-finite or out-of-range scores", () => {
    expect(getCompleteWeeklyScorePercent([{ score: Number.NaN }], 1)).toBeNull();
    expect(getCompleteWeeklyScorePercent([{ score: Number.POSITIVE_INFINITY }], 1)).toBeNull();
    expect(getCompleteWeeklyScorePercent([{ score: 1.5 }], 1)).toBeNull();
    expect(getCompleteWeeklyScorePercent([{ score: -0.1 }], 1)).toBeNull();
  });

  it("returns unavailable for an empty or invalid question count", () => {
    expect(getCompleteWeeklyScorePercent([], 0)).toBeNull();
    expect(getCompleteWeeklyScorePercent([], 1.5)).toBeNull();
  });
});

describe("getWeeklyScorePercent", () => {
  it("converts valid final scores and preserves a genuine zero", () => {
    expect(getWeeklyScorePercent(8, 10)).toBe(80);
    expect(getWeeklyScorePercent(0, 10)).toBe(0);
  });

  it("returns unavailable for missing or invalid final scores", () => {
    expect(getWeeklyScorePercent(null, 10)).toBeNull();
    expect(getWeeklyScorePercent(Number.NaN, 10)).toBeNull();
    expect(getWeeklyScorePercent(11, 10)).toBeNull();
    expect(getWeeklyScorePercent(1, 0)).toBeNull();
  });
});
