/**
 * Tests for behavioral signal translation + confidence mismatch detection.
 *
 * These functions power the "behavioral insights" shown to students after
 * practice questions + the "confidence mismatch" labels shown to teachers
 * in the portfolio. A regression here would make the AI's behavioral
 * feedback meaningless or misleading.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  translateBehavioralSignals,
  getConfidenceMismatchLabel,
} from "../ai-provider";

// ============================================================
// translateBehavioralSignals — turns raw signals into plain-English insights
// ============================================================
describe("translateBehavioralSignals", () => {
  it("returns an array (possibly empty)", () => {
    const result = translateBehavioralSignals("moderate", "moderate", "moderate", 75);
    expect(Array.isArray(result)).toBe(true);
  });

  it("flags high cognitive load", () => {
    const result = translateBehavioralSignals("high", "moderate", "moderate", 50);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.includes("stretching"))).toBe(true);
  });

  it("notes when student is comfortable with low load + high correctness", () => {
    const result = translateBehavioralSignals("low", "moderate", "moderate", 85);
    expect(result.some(r => r.includes("comfortable"))).toBe(true);
  });

  it("flags overconfidence (high confidence, low correctness)", () => {
    const result = translateBehavioralSignals("moderate", "high", "moderate", 40);
    expect(result.some(r => r.includes("double-check") || r.includes("sure"))).toBe(true);
  });

  it("encourages underconfident students who scored well", () => {
    const result = translateBehavioralSignals("moderate", "low", "moderate", 85);
    expect(result.some(r => r.includes("know this better") || r.includes("trust"))).toBe(true);
  });

  it("notes when uncertainty was warranted (low confidence + low score)", () => {
    const result = translateBehavioralSignals("moderate", "low", "moderate", 40);
    expect(result.some(r => r.includes("uncertainty") || r.includes("support") || r.includes("review"))).toBe(true);
  });

  it("flags low metacognitive awareness", () => {
    const result = translateBehavioralSignals("moderate", "moderate", "low", 60);
    expect(result.some(r => r.includes("explaining") || r.includes("out loud"))).toBe(true);
  });

  it("praises high metacognitive awareness", () => {
    const result = translateBehavioralSignals("moderate", "moderate", "high", 80);
    expect(result.some(r => r.includes("self-aware") || r.includes("Strong"))).toBe(true);
  });

  it("returns empty array for moderate signals with moderate correctness", () => {
    // No interesting patterns to report
    const result = translateBehavioralSignals("moderate", "moderate", "moderate", 70);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// getConfidenceMismatchLabel — teacher-facing label for confidence vs ability
// ============================================================
describe("getConfidenceMismatchLabel", () => {
  it("returns 'Overconfident' for high confidence + low correctness", () => {
    const label = getConfidenceMismatchLabel("high", 40);
    expect(label).toContain("Overconfident");
  });

  it("returns 'Underconfident' for low confidence + high correctness", () => {
    const label = getConfidenceMismatchLabel("low", 85);
    expect(label).toContain("Underconfident");
  });

  it("returns 'Appropriately uncertain' for low confidence + low correctness", () => {
    const label = getConfidenceMismatchLabel("low", 40);
    expect(label).toContain("Appropriately uncertain");
  });

  it("returns 'Calibrated' when confidence matches ability", () => {
    expect(getConfidenceMismatchLabel("high", 90)).toContain("Calibrated");
    expect(getConfidenceMismatchLabel("moderate", 70)).toContain("Calibrated");
    expect(getConfidenceMismatchLabel("low", 50)).toContain("Calibrated"); // 50 is not < 50
  });

  it("uses the 60 threshold for overconfidence (not 50)", () => {
    // correctness < 60 with high confidence → overconfident
    expect(getConfidenceMismatchLabel("high", 59)).toContain("Overconfident");
    // correctness >= 60 with high confidence → calibrated
    expect(getConfidenceMismatchLabel("high", 60)).toContain("Calibrated");
  });

  it("uses the 80 threshold for underconfidence", () => {
    // correctness >= 80 with low confidence → underconfident
    expect(getConfidenceMismatchLabel("low", 80)).toContain("Underconfident");
    // correctness < 80 with low confidence → appropriately uncertain (if < 50)
    expect(getConfidenceMismatchLabel("low", 79)).toContain("Calibrated"); // 50-79 is calibrated
  });
});
