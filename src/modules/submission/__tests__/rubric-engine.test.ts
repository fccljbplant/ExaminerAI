/**
 * Tests for src/modules/submission/lib/rubric-engine.ts (pure weighted grader).
 *
 * Covers REDESIGN-P4 §5 rubric math: normalization per criterion, weight
 * scaling onto the rubric's maxScore, human-entries-beat-AI-drafts, unknown
 * keys ignored, and score clamping to each criterion's max.
 */

import { describe, it, expect } from "vitest";
import { criterionMax, grade, type RubricDef } from "../lib/rubric-engine";

function makeRubric(): RubricDef {
  return {
    id: "r1",
    title: "Test rubric",
    maxScore: 100,
    criteria: [
      {
        key: "compliance",
        label: "Compliance",
        weight: 2,
        aiAssist: false,
        levels: [
          { level: 0, label: "No", score: 0 },
          { level: 1, label: "Partial", score: 10 },
          { level: 2, label: "Full", score: 20 },
        ],
      },
      {
        key: "reflection",
        label: "Reflection",
        weight: 1,
        aiAssist: true,
        levels: [
          { level: 0, label: "Missing", score: 0 },
          { level: 1, label: "Done", score: 10 },
        ],
      },
    ],
  };
}

describe("criterionMax", () => {
  it("returns the highest level score", () => {
    expect(criterionMax(makeRubric().criteria[0])).toBe(20);
    expect(criterionMax(makeRubric().criteria[1])).toBe(10);
  });
});

describe("grade", () => {
  it("scores 100 when every criterion is at max", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 20 },
      { criterionKey: "reflection", score: 10 },
    ]);
    expect(result.totalScore).toBe(100);
    expect(result.coverage).toBe(1);
    expect(result.aiDraftCount).toBe(0);
  });

  it("weights partial scores onto the rubric scale", () => {
    // compliance half (10/20 = 0.5) * w2, reflection full (1.0) * w1
    // weightedSum = 0.5*2 + 1.0*1 = 2 ; totalWeight = 3 → 66.67
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 10 },
      { criterionKey: "reflection", score: 10 },
    ]);
    expect(result.totalScore).toBeCloseTo(66.67, 1);
    expect(result.coverage).toBe(1);
  });

  it("counts ungraded criteria as zero and reports coverage", () => {
    const result = grade(makeRubric(), [{ criterionKey: "compliance", score: 20 }]);
    expect(result.coverage).toBe(0.5);
    expect(result.totalScore).toBeCloseTo(66.67, 1);
  });

  it("clamps a score above the criterion max", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 999 },
      { criterionKey: "reflection", score: 999 },
    ]);
    expect(result.totalScore).toBe(100);
  });

  it("ignores entries referencing unknown criterion keys", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 20 },
      { criterionKey: "ghost", score: 10 },
    ]);
    expect(result.coverage).toBe(0.5);
  });

  it("human entry beats an AI draft for the same criterion", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "reflection", score: 4, aiDraft: true },
      { criterionKey: "reflection", score: 10, aiDraft: false },
    ]);
    const reflection = result.perCriterion.find((c) => c.criterionKey === "reflection");
    expect(reflection?.score).toBe(10);
    expect(reflection?.aiDraft).toBe(false);
    expect(result.aiDraftCount).toBe(0);
  });

  it("tracks AI drafts when no human entry exists", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 20 },
      { criterionKey: "reflection", score: 6, aiDraft: true },
    ]);
    expect(result.aiDraftCount).toBe(1);
  });

  it("returns zero for an empty rubric (no criteria)", () => {
    const result = grade({ id: "x", title: "", maxScore: 100, criteria: [] }, []);
    expect(result.totalScore).toBe(0);
    expect(result.coverage).toBe(0);
  });

  it("exposes per-criterion normalized + note details", () => {
    const result = grade(makeRubric(), [
      { criterionKey: "compliance", score: 10, note: "good" },
    ]);
    const compliance = result.perCriterion.find((c) => c.criterionKey === "compliance");
    expect(compliance).toMatchObject({
      score: 10,
      maxScore: 20,
      normalized: 0.5,
      note: "good",
    });
  });
});
