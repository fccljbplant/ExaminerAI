/**
 * Unified test engine — shared logic for ALL test types
 * (practice, daily test, weekly test).
 *
 * ONE chatbot, ONE set of rules, ONE grading contract, ONE behavioral
 * logging pipeline. The only differences between test types are:
 *
 *   - totalQuestions: 3 for practice/daily, 15 for weekly
 *   - maxRepliesPerQuestion: 2-3 for practice/daily, 5 for weekly
 *   - testKind: "practice" | "daily_test" | "weekly_test" (affects grading prompt framing)
 *
 * Per-question explanations:
 *   After EVERY question (when the examiner advances to the next one),
 *   `gradeOneQuestion` produces a QuestionExplanation for that question
 *   only. The student sees it immediately in the chat — not at the end.
 *   This makes tests teach, not just grade.
 *
 * Behavioral logging:
 *   Every reply runs `runAnalysisPipeline` with the conversation-so-far
 *   so the 7-dimension psych evidence updates incrementally, not just
 *   at test-end. Teachers see daily-updated behavioral trends.
 *
 * Token-cache awareness:
 *   Per-question grading calls are NOT cacheable (each student's answer
 *   is unique). The unified grader's `gradeTest` (final, end-of-test)
 *   IS cacheable for the grading template, but the transcript makes the
 *   cache key unique per student — so effectively a no-op for grading.
 */

import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import type { QuestionExplanation, TestKind } from "./unified-grader";
import { parseQuestionExplanations } from "./unified-grader";

/** Test-type configuration. Practice/daily are short (3 questions),
 *  weekly is the full exam (15 questions). */
export interface TestTypeConfig {
  testKind: TestKind;
  totalQuestions: number;
  maxRepliesPerQuestion: number;
  /** Question types rotation — used in the system prompt to vary question style. */
  questionTypes?: string[];
}

export const PRACTICE_CONFIG: TestTypeConfig = {
  testKind: "practice",
  totalQuestions: 3,
  maxRepliesPerQuestion: 3,
  questionTypes: [
    "a CONCEPTUAL question about what this topic IS and WHY it matters",
    "an IMPLEMENTATION question about HOW to use this topic in practice",
    "an APPLIED/EDGE-CASE question about what happens in unusual situations or when things go wrong",
  ],
};

export const DAILY_TEST_CONFIG: TestTypeConfig = {
  testKind: "daily_test",
  totalQuestions: 3,
  maxRepliesPerQuestion: 2,
  questionTypes: [
    "a CONCEPTUAL question about what this topic IS and WHY it matters",
    "an IMPLEMENTATION question about HOW to use this topic in practice",
    "an APPLIED/EDGE-CASE question about what happens in unusual situations or when things go wrong",
  ],
};

export const WEEKLY_TEST_CONFIG: TestTypeConfig = {
  testKind: "weekly_test",
  totalQuestions: 15,
  maxRepliesPerQuestion: 5,
  questionTypes: [
    // Q1-5: Conceptual
    "a CONCEPTUAL 'Why Probe' question — why does something work the way it does",
    "a CONCEPTUAL 'Break-It' question — describe a broken situation, ask what could cause it",
    "a CONCEPTUAL 'Client Translation' question — explain a concept to a non-technical client",
    "a CONCEPTUAL 'Edge Case' question — what happens in unusual situations",
    "a CONCEPTUAL 'Why Probe' question — why a specific design decision was made",
    // Q6-10: Implementation
    "an IMPLEMENTATION question — how to configure/use a tool in practice",
    "an IMPLEMENTATION question — how to deploy or set up something",
    "an IMPLEMENTATION 'Break-It' question — a practical problem and how to fix it",
    "an IMPLEMENTATION question — best practices for using a tool",
    "an IMPLEMENTATION question — how two tools/parts connect",
    // Q11-15: Applied/Edge cases
    "an APPLIED question — troubleshooting a real-world failure",
    "an APPLIED question — what to do when something breaks in production",
    "an APPLIED 'Edge Case' question — scale, security, or performance edge case",
    "an APPLIED question — comparing two approaches and choosing one",
    "an APPLIED question — reflection on what they've learned and what's next",
  ],
};

/** Get the appropriate config for a test kind. */
export function getTestConfig(testKind: TestKind): TestTypeConfig {
  switch (testKind) {
    case "practice": return PRACTICE_CONFIG;
    case "daily_test": return DAILY_TEST_CONFIG;
    case "weekly_test": return WEEKLY_TEST_CONFIG;
  }
}

/** Chat message shape used by all test endpoints. */
export interface UnifiedChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex: number;
  confidenceRating?: "low" | "medium" | "high" | null;
  /** Per-question explanation — attached to the LAST examiner message
   *  of each question (the one that advances to the next question). */
  questionExplanation?: QuestionExplanation;
}

/** Per-question grading — produces a QuestionExplanation for ONE question.
 *
 *  Called immediately after the examiner advances from question N to N+1
 *  (or after the test ends on the last question). The student sees the
 *  explanation appear in the chat right when they move on — they don't
 *  have to wait for the whole test to finish.
 *
 *  Always returns a valid QuestionExplanation — never throws. On AI
 *  failure, returns a fallback explanation. */
export async function gradeOneQuestion(args: {
  question: string;
  studentAnswers: string[]; // all the student's replies to this question
  topic: string;
  testKind: TestKind;
  studentName: string;
}): Promise<QuestionExplanation> {
  const { question, studentAnswers, topic, testKind, studentName } = args;

  if (studentAnswers.length === 0 || !question) {
    return fallbackQuestionExplanation(question || "(question unavailable)", topic);
  }

  const transcript = `Question: ${question}\n\nStudent's answers (in order):\n${studentAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;

  const prompt = `You are grading ${studentName}'s answer to ONE question in a ${testKind.replace("_", " ")} on "${topic}".

LANGUAGE: Match the student's language — but ALWAYS write in Roman (Latin/English) script, NEVER native scripts. If they wrote "tum kon ho?" (Roman Urdu), write the entire response in Roman Urdu. Technical terms stay in English.

${transcript}

Produce a TEACHING explanation so the student learns from THIS question right now:

Return ONLY this JSON object (no prose, no markdown fences):
{
  "questionIndex": 0,
  "question": "<the question you asked, verbatim or close>",
  "studentAnswer": "<student's answer, summarized in 1-2 sentences>",
  "correctAnswer": "<the RIGHT answer, 1-2 sentences, plain language. What they SHOULD have said.>",
  "explanation": "<2-3 sentences explaining WHY the correct answer is correct — cause-and-effect, the trade-off. Teach the concept.>",
  "encouragement": "<ONE sentence specific encouragement for THIS question — what they did well OR what to try next time. Never harsh.>"
}`;

  try {
    const result = await callAI(
      [{ role: "user", content: prompt }],
      {
        temperature: 0.4,
        maxTokens: 500,
        feature: `${testKind}-question-explain`,
        // NOT cacheable — each student's answer is unique
      },
    );

    const parsed = parseQuestionExplanations([{
      questionIndex: 0,
      question,
      studentAnswer: studentAnswers.join(" ").slice(0, 200),
      ...parseJsonSafe(result.text || "{}"),
    }]);

    if (parsed.length > 0) return parsed[0];
    return fallbackQuestionExplanation(question, topic);
  } catch (err) {
    logger.warn(`${testKind} per-question grading failed`, {
      topic, question: question.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackQuestionExplanation(question, topic);
  }
}

/** Build a fallback QuestionExplanation when the AI call fails. Always succeeds. */
function fallbackQuestionExplanation(question: string, topic: string): QuestionExplanation {
  return {
    questionIndex: 0,
    question: question || "(question unavailable)",
    studentAnswer: "(no answer captured)",
    correctAnswer: `A strong answer on "${topic}" would explain the core idea in your own words and give one concrete example.`,
    explanation: `This concept matters because it's foundational to "${topic}". Try relating it to a real situation you might face in your project — that makes the abstract idea concrete.`,
    encouragement: "Keep practicing — every attempt teaches you something. Review the topic and try again.",
  };
}

/** Light-weight JSON.parse wrapper that never throws. Extracts the first
 *  {...} block in case the AI wrapped the JSON in prose. */
function parseJsonSafe(text: string): Record<string, unknown> {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Determine if the examiner's reply signals advancing to the next question.
 *  Returns true if the [ADVANCE] marker is present (per SHARED_EXAMINER_RULES). */
export function isAdvanceSignal(examinerReply: string): boolean {
  return /\[ADVANCE\]/i.test(examinerReply);
}

/** Strip the [ADVANCE] marker from the examiner's reply before showing to student. */
export function stripAdvanceMarker(examinerReply: string): string {
  return examinerReply.replace(/\[ADVANCE\]/gi, "").trim();
}

/** Delimiter the AI uses to separate feedback from the next question when
 *  advancing. Instructed in SHARED_EXAMINER_RULES (sections 4 and 5).
 *
 *  Example AI response when advancing:
 *    "Good attempt — you got the why right. The gap is the how.\n|||NEXT|||\nWhy does WordPress need both a database and files?"
 *
 *  The server splits on |||NEXT||| to produce TWO chat bubbles:
 *    (1) feedback for the question that just ended (with questionExplanation card)
 *    (2) the next question (standalone)
 *
 *  Why two bubbles: when the chat auto-scrolls to the bottom, the student
 *  lands on the new question. The feedback/correction is one bubble up —
 *  visible without scrolling — instead of being buried inside one long
 *  combined message that the student has to scroll up through. */
export const ADVANCE_SPLIT_DELIMITER = "|||NEXT|||";

export interface SplitAdvanceResult {
  /** True when the delimiter was found AND both sides are non-empty.
   *  Caller should push two messages (feedback + nextQuestion).
   *  False when no delimiter — caller should push the full cleaned
   *  response as a single message (backward-compatible fallback). */
  split: boolean;
  /** Feedback portion (for the question that just ended).
   *  Empty when split === false. */
  feedback: string;
  /** Next-question portion.
   *  Empty when split === false. */
  nextQuestion: string;
  /** The full cleaned response (delimiter + [ADVANCE] markers stripped).
   *  Use this as the single message body when split === false. */
  full: string;
}

/** Parse an examiner reply that may contain the [ADVANCE] marker AND the
 *  |||NEXT||| split delimiter. Always strips both markers (case-insensitive,
 *  whitespace-tolerant). Returns the split result so the caller can decide
 *  whether to push one or two chat bubbles.
 *
 *  Safe to call on any examiner reply — probing replies (no delimiter)
 *  return split=false with full=cleaned response. */
export function splitAdvanceResponse(rawExaminerReply: string): SplitAdvanceResult {
  // Strip [ADVANCE] marker (case-insensitive, whitespace-tolerant) and
  // any stray [NEXT] bracket marker (defensive — the AI should use |||NEXT|||,
  // but if it accidentally writes [NEXT] we still clean it up).
  // Also collapse any double-spaces left behind by the strip so the
  // student never sees weird spacing artifacts.
  let cleaned = rawExaminerReply
    .replace(/\[\s*ADVANCE\s*\]/gi, "")
    .replace(/\[\s*NEXT\s*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Look for the delimiter with whitespace tolerance:
  // matches "|||NEXT|||", "||| NEXT |||", "|||next|||", etc.
  const delimRegex = /\|\|\|\s*NEXT\s*\|\|\|/i;
  const match = cleaned.match(delimRegex);
  if (!match || match.index === undefined) {
    // No delimiter — return the cleaned response as a single message.
    return { split: false, feedback: "", nextQuestion: "", full: cleaned };
  }

  const idx = match.index;
  const feedback = cleaned.slice(0, idx).trim();
  const nextQuestion = cleaned.slice(idx + match[0].length).trim();

  // Always strip the delimiter from `cleaned` so the fallback `full` value
  // never leaks the delimiter to the student. We do this regardless of
  // whether we end up splitting — defensive cleanup.
  // Also collapse any double-spaces left behind by the strip.
  cleaned = cleaned.replace(delimRegex, " ").replace(/\s{2,}/g, " ").trim();

  // Defensive: if either side is empty, the AI misused the delimiter.
  // Fall back to single-message behavior so the student still sees the
  // full response (with the delimiter stripped).
  if (!feedback || !nextQuestion) {
    return { split: false, feedback: "", nextQuestion: "", full: cleaned };
  }

  return { split: true, feedback, nextQuestion, full: cleaned };
}
