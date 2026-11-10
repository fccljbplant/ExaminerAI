import { describe, it, expect } from "vitest";
import {
  normalizeScore,
  levelFromAverage,
  weightedAverage,
  LEARN_DIFFICULTY_DIRECTIVES,
} from "@/modules/learn/lib/learner-difficulty";
import { levelLabel } from "@/lib/assessment/adaptive";

/**
 * learner-difficulty — question difficulty adapts to the LEARNER's
 * recent test performance (2026-09 model). Pure-function coverage:
 * score normalization, band mapping, recency/kind weighting, and the
 * directive table invariant (one application-first directive per level).
 */

describe("normalizeScore", () => {
  it("maps a daily final score (sum of 0..1 scores) into 0..1", () => {
    expect(normalizeScore(2.5, 3)).toBeCloseTo(2.5 / 3);
  });

  it("maps a weekly final score (0..10) into 0..1", () => {
    expect(normalizeScore(7, 10)).toBe(0.7);
  });

  it("clamps out-of-range input", () => {
    expect(normalizeScore(99, 3)).toBe(1);
    expect(normalizeScore(-5, 3)).toBe(0);
  });

  it("returns 0 for degenerate question counts", () => {
    expect(normalizeScore(5, 0)).toBe(0);
    expect(normalizeScore(Number.NaN, 3)).toBe(0);
  });
});

describe("levelFromAverage", () => {
  it("bands match the 2026-09 spec", () => {
    expect(levelFromAverage(0.95)).toBe(5);
    expect(levelFromAverage(0.85)).toBe(5);
    expect(levelFromAverage(0.84)).toBe(4);
    expect(levelFromAverage(0.7)).toBe(4);
    expect(levelFromAverage(0.69)).toBe(3);
    expect(levelFromAverage(0.55)).toBe(3);
    expect(levelFromAverage(0.54)).toBe(2);
    expect(levelFromAverage(0.4)).toBe(2);
    expect(levelFromAverage(0.39)).toBe(1);
    expect(levelFromAverage(0)).toBe(1);
  });
});

describe("weightedAverage", () => {
  it("returns 0 for an empty window", () => {
    expect(weightedAverage([])).toBe(0);
  });

  it("weights newer entries more (linear recency)", () => {
    // [0, 1] → weights 1,2 → (0*1 + 1*2)/3 = 0.666…
    expect(weightedAverage([{ score: 0, weight: 1 }, { score: 1, weight: 1 }])).toBeCloseTo(2 / 3);
  });

  it("weekly entries (weight 2) count double at equal recency", () => {
    // Recency × kind weight multiply: entry 1 gets (2×2)=4 vs entry 0's 1.
    expect(weightedAverage([{ score: 0, weight: 1 }, { score: 1, weight: 2 }])).toBeCloseTo(4 / 5);
  });
});

describe("directive table", () => {
  it("has exactly one directive per level 1..5", () => {
    expect(LEARN_DIFFICULTY_DIRECTIVES).toHaveLength(5);
    for (const d of LEARN_DIFFICULTY_DIRECTIVES) expect(d.length).toBeGreaterThan(40);
  });

  it("every directive stays application-first (no bare definitions)", () => {
    for (const d of LEARN_DIFFICULTY_DIRECTIVES) {
      expect(/WHY|HOW|application|scenario|work situation|trade-off|concepts|diagnosis|justif/i.test(d)).toBe(true);
    }
  });

  it("labels reuse the shared adaptive vocabulary", () => {
    expect(levelLabel(1)).toBe("Warm-up");
    expect(levelLabel(5)).toBe("Expert");
  });
});
