/**
 * Tests for src/modules/assessment/lib/exam-session.ts (pure state machine).
 *
 * Covers the W5 runner lifecycle: answer upsert (idempotent, flagged
 * preservation), score math with unanswered-as-zero, resume index
 * advance, completion guards, and kind helpers.
 */

import { describe, it, expect } from "vitest";
import {
  answeredCount,
  completionCheck,
  computeScore,
  examKindLabel,
  examXpReason,
  isPass,
  nextIndex,
  upsertAnswer,
  type AnswerGrade,
} from "@/modules/assessment/lib/exam-session";

const GRADE: AnswerGrade = {
  score: 80,
  explanation: "explanation",
  correctAnswer: "correct",
};

describe("upsertAnswer", () => {
  it("appends a record for a new index", () => {
    const answers = upsertAnswer([], { index: 0, answer: "a1" }, "Q1", "open", GRADE);
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ index: 0, answer: "a1", score: 80, flagged: false });
  });

  it("replaces an existing record at the same index (idempotent re-save)", () => {
    let answers = upsertAnswer([], { index: 0, answer: "draft" }, "Q1", "open", {
      ...GRADE,
      score: 40,
    });
    answers = upsertAnswer(answers, { index: 0, answer: "final" }, "Q1", "open", GRADE);
    expect(answers).toHaveLength(1);
    expect(answers[0].answer).toBe("final");
    expect(answers[0].score).toBe(80);
  });

  it("keeps records sorted by index regardless of write order", () => {
    let answers = upsertAnswer([], { index: 2, answer: "c" }, "Q3", "open", GRADE);
    answers = upsertAnswer(answers, { index: 0, answer: "a" }, "Q1", "open", GRADE);
    answers = upsertAnswer(answers, { index: 1, answer: "b" }, "Q2", "open", GRADE);
    expect(answers.map((a) => a.index)).toEqual([0, 1, 2]);
  });

  it("preserves the flagged state from an earlier save when omitted", () => {
    let answers = upsertAnswer([], { index: 0, answer: "a", flagged: true }, "Q1", "open", GRADE);
    answers = upsertAnswer(answers, { index: 0, answer: "a2" }, "Q1", "open", GRADE);
    expect(answers[0].flagged).toBe(true);
  });
});

describe("computeScore", () => {
  it("averages answered scores over the total (unanswered = 0)", () => {
    const answers = [
      { index: 0, question: "q", format: "open", answer: "a", score: 100, explanation: "", correctAnswer: "", flagged: false },
    ];
    expect(computeScore(answers, 3)).toBeCloseTo(33.33, 1);
    expect(computeScore(answers, 1)).toBe(100);
  });

  it("returns 0 for no answers and for zero total", () => {
    expect(computeScore([], 3)).toBe(0);
    expect(computeScore([], 0)).toBe(0);
  });
});

describe("isPass", () => {
  it("passes at or above the threshold, fails below, null = not graded", () => {
    expect(isPass(60)).toBe(true);
    expect(isPass(100)).toBe(true);
    expect(isPass(59.9)).toBe(false);
    expect(isPass(null)).toBe(false);
  });
});

describe("nextIndex", () => {
  it("advances when the current question is already answered", () => {
    const answers = [
      { index: 0, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
    ];
    expect(nextIndex(0, answers, 3)).toBe(1);
  });

  it("stays put when the current question is unanswered", () => {
    expect(nextIndex(0, [], 3)).toBe(0);
    expect(nextIndex(1, [], 3)).toBe(1);
  });

  it("clamps at the last question", () => {
    const answers = [
      { index: 0, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
      { index: 1, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
    ];
    expect(nextIndex(1, answers, 2)).toBe(1);
  });
});

describe("answeredCount + completionCheck", () => {
  it("counts graded questions", () => {
    const answers = [
      { index: 0, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
      { index: 2, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
    ];
    expect(answeredCount(answers, 3)).toBe(2);
    expect(answeredCount(answers, 10)).toBe(2);
  });

  it("flags missing questions in the completion check", () => {
    const answers = [
      { index: 0, question: "q", format: "open", answer: "a", score: 1, explanation: "", correctAnswer: "", flagged: false },
    ];
    expect(completionCheck(answers, 3)).toEqual({ ok: false, missing: 2 });
    expect(completionCheck(answers, 1)).toEqual({ ok: true, missing: 0 });
    expect(completionCheck([], 0)).toEqual({ ok: true, missing: 0 });
  });
});

describe("kind helpers", () => {
  it("labels and XP reasons per kind", () => {
    expect(examKindLabel("daily")).toBe("Daily check-in");
    expect(examKindLabel("weekly")).toBe("Weekly test");
    expect(examXpReason("daily")).toBe("daily_test_done");
    expect(examXpReason("weekly")).toBe("weekly_test_done");
  });
});
