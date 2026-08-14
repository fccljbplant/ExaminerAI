/**
 * Tests for src/modules/submission/lib/ai-draft.ts (pure helpers).
 *
 * Covers the P2 §3.4 text-only law for AI drafting: only aiAssist
 * criteria are eligible, the prompt is built exclusively from the
 * text-only packet, and levels/keys are clamped to the rubric.
 */

import { describe, it, expect } from "vitest";
import { aiDraftCriteria, buildAiDraftPrompt } from "@/modules/submission/lib/ai-draft";
import type { RubricCriterionDef } from "@/modules/submission/lib/rubric-engine";

function criterion(overrides: Partial<RubricCriterionDef>): RubricCriterionDef {
  return {
    key: "c1",
    label: "Criterion",
    weight: 1,
    aiAssist: false,
    levels: [
      { level: 0, label: "No", score: 0 },
      { level: 1, label: "Partial", score: 10 },
    ],
    ...overrides,
  };
}

describe("aiDraftCriteria", () => {
  it("keeps only aiAssist criteria", () => {
    const criteria = [
      criterion({ key: "a", aiAssist: true }),
      criterion({ key: "b", aiAssist: false }),
      criterion({ key: "c", aiAssist: true }),
    ];
    expect(aiDraftCriteria(criteria).map((c) => c.key)).toEqual(["a", "c"]);
  });

  it("drops aiAssist criteria without levels (nothing to score against)", () => {
    const criteria = [criterion({ key: "a", aiAssist: true, levels: [] })];
    expect(aiDraftCriteria(criteria)).toEqual([]);
  });

  it("returns empty for a fully human rubric", () => {
    expect(aiDraftCriteria([criterion({ aiAssist: false })])).toEqual([]);
  });
});

describe("buildAiDraftPrompt", () => {
  const criteria = [
    criterion({
      key: "reflection",
      label: "Safety reflection",
      weight: 1,
      aiAssist: true,
      levels: [
        { level: 0, label: "Missing", score: 0 },
        { level: 1, label: "Thoughtful", score: 10 },
      ],
    }),
  ];

  it("embeds the submission text verbatim (the only evidence)", () => {
    const prompt = buildAiDraftPrompt("My summary: I checked the harness.", criteria, "HSE task");
    expect(prompt).toContain("My summary: I checked the harness.");
    expect(prompt).toContain('"Safety reflection" (weight 1)');
    expect(prompt).toContain("0 pts: Missing");
    expect(prompt).toContain("10 pts: Thoughtful");
  });

  it("tells the AI to return [] when there is no readable text", () => {
    const prompt = buildAiDraftPrompt("", criteria, "HSE task");
    expect(prompt).toContain("(no readable text");
    expect(prompt).toContain("return []");
  });

  it("names the assignment in the task line", () => {
    const prompt = buildAiDraftPrompt("text", criteria, "HSE Work-at-Height");
    expect(prompt).toContain('to "HSE Work-at-Height"');
  });
});
