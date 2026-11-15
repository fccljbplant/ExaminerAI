import { describe, expect, it } from "vitest";

import { readPosition, ringPercent } from "../course-position";

describe("readPosition (masteryMap → current week/day)", () => {
  it("reads the current position when present", () => {
    expect(
      readPosition({ topicProgress: { current: { week: 3, day: 5 } } }),
    ).toEqual({ week: 3, day: 5 });
  });

  it("defaults day to 1 when only a week exists", () => {
    expect(readPosition({ topicProgress: { current: { week: 2 } } })).toEqual({
      week: 2,
      day: 1,
    });
  });

  it("returns null for null, shapeless maps or week-less currents", () => {
    expect(readPosition(null)).toBeNull();
    expect(readPosition({})).toBeNull();
    expect(readPosition({ topicProgress: {} })).toBeNull();
    expect(readPosition({ topicProgress: { current: { day: 4 } } })).toBeNull();
  });
});

describe("ringPercent (coarse completion share)", () => {
  it("computes completed-days share of the course", () => {
    // Week 2 of 4 → (1*7 + 0) / 28 = 25%
    expect(ringPercent({ week: 2, day: 1 }, 4)).toBe(25);
    // Week 5, day 3 of 6 → (4*7 + 2) / 42 = 71%
    expect(ringPercent({ week: 5, day: 3 }, 6)).toBe(71);
  });

  it("clamps at 100 and drops zero-denominator cases", () => {
    expect(ringPercent({ week: 9, day: 7 }, 8)).toBe(100);
    expect(ringPercent({ week: 2, day: 1 }, 0)).toBe(0);
    expect(ringPercent(null, 8)).toBe(0);
  });
});
