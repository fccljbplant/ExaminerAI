/**
 * Tests for the AI provider's pure functions — the scoring logic that
 * translates raw behavioral signals into plain-language insights.
 *
 * These are the highest-value tests in the codebase: a silent break in
 * translateBehavioralSignals() or getConfidenceMismatchLabel() would
 * directly degrade the student feedback UX with no obvious error.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  translateBehavioralSignals,
  getConfidenceMismatchLabel,
  TOKEN_BUDGET,
} from "../ai-provider";

describe("translateBehavioralSignals", () => {
  it("returns an insight for high cognitive load", () => {
    const insights = translateBehavioralSignals("high", "moderate", "moderate", 50);
    expect(insights).toContain(
      "This topic is stretching you right now — that's normal for something new. Take it one step at a time."
    );
  });

  it("suggests peer explanation when comfortable + high score", () => {
    const insights = translateBehavioralSignals("low", "high", "moderate", 85);
    expect(insights.some(i => i.includes("explaining it to a peer"))).toBe(true);
  });

  it("flags overconfidence (high confidence + low correctness)", () => {
    const insights = translateBehavioralSignals("moderate", "high", "moderate", 40);
    expect(insights.some(i => i.includes("more sure than the answer was right"))).toBe(true);
  });

  it("encourages underconfident student (low confidence + high score)", () => {
    const insights = translateBehavioralSignals("moderate", "low", "moderate", 85);
    expect(insights.some(i => i.includes("trust your first instinct"))).toBe(true);
  });

  it("validates uncertainty (low confidence + low score)", () => {
    const insights = translateBehavioralSignals("moderate", "low", "moderate", 40);
    expect(insights.some(i => i.includes("let's review this concept together"))).toBe(true);
  });

  it("prompts metacognition for low metacognitive", () => {
    const insights = translateBehavioralSignals("moderate", "moderate", "low", 70);
    expect(insights.some(i => i.includes("explaining this out loud"))).toBe(true);
  });

  it("praises high metacognition", () => {
    const insights = translateBehavioralSignals("moderate", "moderate", "high", 70);
    expect(insights.some(i => i.includes("Strong self-awareness"))).toBe(true);
  });

  it("returns empty array for moderate/moderate/moderate with mid score", () => {
    const insights = translateBehavioralSignals("moderate", "moderate", "moderate", 70);
    expect(insights).toEqual([]);
  });
});

describe("getConfidenceMismatchLabel", () => {
  it("labels overconfidence correctly", () => {
    expect(getConfidenceMismatchLabel("high", 40)).toBe(
      "Overconfident — doesn't know what they don't know"
    );
  });

  it("labels underconfidence correctly", () => {
    expect(getConfidenceMismatchLabel("low", 85)).toBe(
      "Underconfident — knows more than they think"
    );
  });

  it("labels appropriate uncertainty", () => {
    expect(getConfidenceMismatchLabel("low", 40)).toBe(
      "Appropriately uncertain — needs support"
    );
  });

  it("labels calibrated confidence", () => {
    expect(getConfidenceMismatchLabel("high", 85)).toBe(
      "Calibrated — confidence matches ability"
    );
    expect(getConfidenceMismatchLabel("moderate", 70)).toBe(
      "Calibrated — confidence matches ability"
    );
  });

  it("treats boundary values correctly", () => {
    // Overconfidence threshold: correctness < 60 with high confidence
    expect(getConfidenceMismatchLabel("high", 59)).toContain("Overconfident");
    expect(getConfidenceMismatchLabel("high", 60)).toContain("Calibrated");
    // Underconfidence threshold: correctness >= 80 with low confidence
    expect(getConfidenceMismatchLabel("low", 79)).toContain("Calibrated");
    expect(getConfidenceMismatchLabel("low", 80)).toContain("Underconfident");
    // Appropriate uncertainty: correctness < 50 with low confidence
    expect(getConfidenceMismatchLabel("low", 49)).toContain("Appropriately uncertain");
    expect(getConfidenceMismatchLabel("low", 50)).toContain("Calibrated");
  });
});

describe("TOKEN_BUDGET", () => {
  it("has all expected budget constants", () => {
    expect(TOKEN_BUDGET.QUESTION_GEN).toBe(300);
    expect(TOKEN_BUDGET.EVALUATION).toBe(500);
    expect(TOKEN_BUDGET.WEEKLY_TEST_REPLY).toBe(500);
    // Phase D.4: FINAL_ANALYSIS reduced from 1500 to 1200 after observed
    // production usage showed median 980 tokens, p95 1150. 1200 leaves
    // headroom without truncation risk and saves ~20% per final analysis.
    // Phase Teaching: bumped to 2500 to accommodate per-question
    // explanations (questionExplanations array — one block per question
    // with correctAnswer + explanation + encouragement). For a 15-question
    // weekly test, that's ~15 × ~80 tokens = ~1200 extra tokens.
    expect(TOKEN_BUDGET.FINAL_ANALYSIS).toBe(4000);
    expect(TOKEN_BUDGET.CONNECTION_TEST).toBe(10);
  });

  it("keeps budgets reasonable for quality responses", () => {
    Object.entries(TOKEN_BUDGET).forEach(([key, budget]) => {
      expect(budget).toBeGreaterThanOrEqual(10);
      // Phase 1 v2: cap raised from 1000 to 2000 to allow the enhanced
      // final analysis (per-answer plagiarism breakdown + engagement feedback)
      // to return rich structured data without truncation.
      // Phase Teaching: cap raised to 3000 to also accommodate per-question
      // explanations (one block per question with correctAnswer +
      // explanation + encouragement).
      expect(budget).toBeLessThanOrEqual(5000);
    });
  });
});
