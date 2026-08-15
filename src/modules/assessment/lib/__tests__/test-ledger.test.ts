import { describe, it, expect } from "vitest";
import {
  buildTestLedger,
  ledgerToPrompt,
  buildNextQuestionPrompt,
  type LedgerMessage,
} from "../test-ledger";

const ex = (questionIndex: number, content: string, explanation?: LedgerMessage["questionExplanation"]): LedgerMessage => ({
  role: "examiner",
  content,
  questionIndex,
  questionExplanation: explanation ?? null,
});

const st = (questionIndex: number, content: string): LedgerMessage => ({
  role: "student",
  content,
  questionIndex,
});

describe("test-ledger — compact per-question history", () => {
  it("groups messages per question and extracts the question text", () => {
    const convo: LedgerMessage[] = [
      ex(0, "What is a hazard?"),
      st(0, "Something that can hurt you"),
      ex(0, "Good — next question.", {
        question: "What is a hazard?",
        correctAnswer: "Anything with the potential to cause harm.",
        score: 80,
      }),
      ex(1, "What is a risk?"),
    ];
    const ledger = buildTestLedger(convo);
    expect(ledger).toHaveLength(2);
    expect(ledger[0].question).toContain("hazard");
    expect(ledger[0].answerSummary).toContain("hurt");
    expect(ledger[0].score).toBe(80);
    expect(ledger[0].teachingNote).toContain("potential");
    expect(ledger[1].question).toContain("risk");
    expect(ledger[1].score).toBeNull();
  });

  it("handles empty conversations", () => {
    expect(buildTestLedger([])).toEqual([]);
    expect(ledgerToPrompt([])).toContain("no completed questions");
  });

  it("keeps the prompt compact even with many long messages", () => {
    const convo: LedgerMessage[] = [];
    for (let i = 0; i < 10; i++) {
      convo.push(ex(i, `Question number ${i}: ${"very long question text ".repeat(30)}`));
      convo.push(st(i, `Answer ${i}: ${"a very long answer ".repeat(30)}`));
      convo.push(ex(i, "advancing", {
        question: `Q ${i}`,
        correctAnswer: `${"teaching note ".repeat(40)}`,
        score: 50,
      }));
    }
    const prompt = ledgerToPrompt(buildTestLedger(convo));
    // bounded: 10 entries, each truncated to a few hundred chars
    expect(prompt.length).toBeLessThan(10 * 900);
    expect(prompt).toContain("Q10");
  });

  it("builds a next-question prompt with the ledger and topic", () => {
    const messages = buildNextQuestionPrompt({
      systemPrompt: "SYS",
      ledgerText: "LEDGER",
      questionNumber: 4,
      totalQuestions: 10,
      topic: "Lockout-tagout",
      weekLabel: "Week 2 — In practice",
    });
    expect(messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(messages[1].content).toContain("Question 4 of 10");
    expect(messages[1].content).toContain("Lockout-tagout");
    expect(messages[1].content).toContain("LEDGER");
  });
});
