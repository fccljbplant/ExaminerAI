import { describe, expect, it } from "vitest";
import { getLatestScoredTest } from "./roster-metrics";

describe("getLatestScoredTest", () => {
  it("selects the highest week with a real score regardless of input order", () => {
    const latest = getLatestScoredTest([
      { week: 4, score: 72 },
      { week: 9, score: 88 },
      { week: 7, score: 51 },
    ]);

    expect(latest).toEqual({ week: 9, score: 88 });
  });

  it("ignores ungraded future weeks and returns the latest scored week", () => {
    const latest = getLatestScoredTest([
      { week: 12, score: null },
      { week: 8, score: 64 },
      { week: 10, score: null },
    ]);

    expect(latest).toEqual({ week: 8, score: 64 });
  });

  it("returns null when no tests have scores", () => {
    expect(getLatestScoredTest([{ week: 1, score: null }])).toBeNull();
  });
});


describe("getAtRiskKpiCount", () => {
  it("uses the full aggregate count rather than the five-row preview", async () => {
    const { getAtRiskKpiCount } = await import("./roster-metrics");
    expect(getAtRiskKpiCount({ count: 17, items: [{}, {}, {}, {}, {}] })).toBe(17);
  });
});
