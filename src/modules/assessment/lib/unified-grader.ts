/**
 * unified-grader.ts — single grading contract for ALL test types.
 *
 * Every graded test (practice, daily test, weekly test) returns the same
 * shape from its grader:
 *
 *   {
 *     score: number,                  // 0-100
 *     feedback: {
 *       modelAnswer: string,          // what a strong response would have looked like
 *       missedPoints: string[],       // 2-4 specific, actionable gaps
 *       nextTime: string,             // one-sentence coaching tip
 *     }
 *   }
 *
 * Why centralize?
 *  - Students see the SAME teaching card after every test type, regardless
 *    of which grader produced it. Tests teach, not just grade.
 *  - The prompt + JSON shape live in one file, so changing the wording
 *    (e.g. softening tone, adding a "what you did well" field) updates
 *    every test type at once.
 *  - Each route keeps its own fallback when the AI call fails — the
 *    shared code never throws, only returns the fallback.
 *
 * Test-kind-specific differences are passed as `testKind` so the prompt
 * can adjust framing ("practice" vs "graded test") without duplicating
 * the JSON schema.
 */

import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";

export type TestKind = "practice" | "daily_test" | "weekly_test";

/** Per-question explanation — what the right answer was, why, and a
 *  specific encouragement for that question. Rendered in the
 *  TeachingFeedbackCard after the test. */
export interface QuestionExplanation {
  /** 0-based index of the question in the test. */
  questionIndex: number;
  /** The question the examiner asked (verbatim or close). */
  question: string;
  /** Student's answer, summarized in 1-2 sentences. */
  studentAnswer: string;
  /** The RIGHT answer — concise, 1-2 sentences. What they should have said. */
  correctAnswer: string;
  /** 2-3 sentences explaining WHY the right answer is correct. Teaches the concept. */
  explanation: string;
  /** One-sentence specific encouragement for THIS question. Never harsh. */
  encouragement: string;
}

export interface TeachingFeedback {
  /** 2-4 sentences showing what a strong response would have looked like.
   *  Plain prose, like explaining to a peer. */
  modelAnswer: string;
  /** 2-4 specific, actionable gaps in the student's answer. Each item
   *  is one sentence, phrased as "You could have…" — never harsh. */
  missedPoints: string[];
  /** One-sentence coaching tip — what to try next time. */
  nextTime: string;
  /** Per-question breakdown — present for daily + weekly tests
   *  (where there are discrete questions with discrete answers).
   *  Empty for practice (single-topic conversation). */
  questionExplanations: QuestionExplanation[];
}

export interface GradeResult {
  score: number;
  feedback: TeachingFeedback;
}

export interface GradeTestInput {
  /** Plain-text transcript of the conversation. Caller is responsible
   *  for filtering/slicing — this function does not look at message
   *  structure, just text. */
  transcript: string;
  /** Topic name (or "Week N material" if no specific topic). */
  topic: string;
  /** Student display name — used to personalize the prompt. */
  studentName: string;
  /** Which kind of test this is. Adjusts the prompt framing. */
  testKind: TestKind;
  /** When true, the prompt also asks for per-question explanations
   *  (correctAnswer + explanation + encouragement for each question).
   *  Defaults to false for practice, true for daily/weekly. */
  includeQuestionExplanations?: boolean;
}

/** Build the grading prompt. Exported for testing. */
export function buildGradePrompt(input: GradeTestInput): string {
  const { transcript, topic, studentName, testKind, includeQuestionExplanations } = input;

  const kindFraming: Record<TestKind, string> = {
    practice:
      "This is a PRACTICE conversation — not graded for the report card. Be encouraging. The goal is for the student to learn and try again, not to feel judged.",
    daily_test:
      "This is a DAILY check-in test — short, low-stakes. Grade honestly but kindly. The goal is daily mastery data + a teaching moment, not a gate.",
    weekly_test:
      "This is the WEEKLY test — graded and counts toward the report card. Be honest. The student-facing UI buffers low scores with a study plan, so do NOT floor the score artificially.",
  };

  const questionExplanationsBlock = includeQuestionExplanations
    ? `\n\nALSO produce per-question explanations so the student can see the RIGHT answer for every question:\n- "questionExplanations": JSON array, one entry per question in the test. Each entry:\n  {\n    "questionIndex": <0-based index>,\n    "question": "<the question you asked, verbatim or close>",\n    "studentAnswer": "<student's answer, summarized in 1-2 sentences>",\n    "correctAnswer": "<the RIGHT answer, 1-2 sentences, plain language. What they SHOULD have said.>",\n    "explanation": "<2-3 sentences explaining WHY the correct answer is correct — cause-and-effect, the trade-off. Teach the concept.>",\n    "encouragement": "<ONE sentence specific encouragement for THIS question — what they did well OR what to try next time. Never harsh.>"\n  }\nCover EVERY question — do not skip any. Write in the SAME language the student used during the test (Urdu replies → Urdu explanations; English → English; mixed → dominant language). Technical terms stay in English.`
    : "";

  const jsonShape = includeQuestionExplanations
    ? `{"score": <number>, "modelAnswer": "...", "missedPoints": ["...", "..."], "nextTime": "...", "questionExplanations": [{"questionIndex": 0, "question": "...", "studentAnswer": "...", "correctAnswer": "...", "explanation": "...", "encouragement": "..."}]}`
    : `{"score": <number>, "modelAnswer": "...", "missedPoints": ["...", "..."], "nextTime": "..."}`;

  return `You are grading ${studentName}'s ${testKind.replace("_", " ")} on "${topic}".

${kindFraming[testKind]}

LANGUAGE: Match the student's language — but ALWAYS write in Roman (Latin/English) script, NEVER native scripts. If they wrote "tum kon ho?" (Roman Urdu), write the modelAnswer, missedPoints, nextTime, AND questionExplanations in Roman Urdu (e.g. "database ka maqsad data store karna hai"). If they wrote in Urdu/Arabic/Hindi native script, STILL transliterate to Roman script. If English, use English. Technical terms (database, API, plugin) stay in English.

Transcript (Student's answers in order, possibly with Examiner prompts):
${transcript}

This is a TEACHING moment, not just a grade. Be honest but kind — frame gaps as growth, not failure.

Grade the student's conceptual understanding 0-100:
- 90-100: excellent understanding
- 75-89: good understanding
- 50-74: partial understanding (the most common score — beginner level)
- 25-49: major gaps
- 0-24: no real understanding

Then produce TEACHING feedback so the student can learn from this ${testKind.replace("_", " ")}:

- "modelAnswer": 2-4 sentences showing what a strong answer to the topic would have looked like. Use plain language, like explaining to a peer. Cover the core idea, one concrete example, and the trade-off or motivation.
- "missedPoints": JSON array of 2-4 short, specific, actionable points the student's answer missed or could have pushed further. Each item ONE sentence. Phrase as "You could have..." or "Try also mentioning..." — never harsh, never condescending.
- "nextTime": ONE sentence coaching tip for the next ${testKind.replace("_", " ")} (e.g., "Before answering, name one concrete example and one reason-it-matters...").${questionExplanationsBlock}

Return ONLY this JSON object (no prose, no markdown fences):
${jsonShape}`;
}

/** Build a fallback result when the AI call fails. Always succeeds. */
export function fallbackGrade(topic: string, testKind: TestKind, repliesCount: number): GradeResult {
  // For weekly test, give a more conservative fallback score since it
  // counts toward the report card. For practice/daily, give 70 as a
  // neutral "you showed up" score.
  const baseScore = testKind === "weekly_test"
    ? Math.max(20, Math.min(75, 30 + repliesCount * 4))
    : 70;

  const kindLabel = testKind === "weekly_test"
    ? "weekly test"
    : testKind === "daily_test"
    ? "daily test"
    : "practice conversation";

  return {
    score: baseScore,
    feedback: {
      modelAnswer: `A strong answer on "${topic}" would explain the core idea in your own words, give one concrete example, and connect it to a real situation you might face in the bootcamp project. The best answers also mention the trade-off or limitation, not just the happy path.`,
      missedPoints: [
        "Try to give at least one concrete example per question — abstract explanations are harder to evaluate.",
        "Mentioning why this matters (the trade-off or motivation) shows deeper understanding than just describing what it is.",
        "If you weren't sure, reasoning out loud — even starting with \"I think...\" — shows your thinking and lets the examiner help you.",
      ],
      nextTime: `Before your next ${kindLabel}, jot down one concrete example and one reason-it-matters for each topic — that alone will push your score up.`,
      questionExplanations: [],
    },
  };
}

/** Parse the AI's JSON response. Returns null on any parse failure. */
function parseGradeResponse(text: string | undefined, topic: string, testKind: TestKind, repliesCount: number): GradeResult | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  const score = Math.max(0, Math.min(100, Number(parsed.score ?? 70)));
  if (!Number.isFinite(score)) return null;

  const missedRaw = parsed.missedPoints;
  const missed = Array.isArray(missedRaw)
    ? missedRaw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map(s => s.trim())
        .slice(0, 4)
    : [];

  const fallback = fallbackGrade(topic, testKind, repliesCount);

  return {
    score,
    feedback: {
      modelAnswer:
        typeof parsed.modelAnswer === "string" && parsed.modelAnswer.trim()
          ? parsed.modelAnswer.trim()
          : fallback.feedback.modelAnswer,
      missedPoints: missed.length > 0 ? missed : fallback.feedback.missedPoints,
      nextTime:
        typeof parsed.nextTime === "string" && parsed.nextTime.trim()
          ? parsed.nextTime.trim()
          : fallback.feedback.nextTime,
      questionExplanations: parseQuestionExplanations(parsed.questionExplanations),
    },
  };
}

/** Parse the questionExplanations array from the AI response. Returns []
 *  on any parse failure or if the field is missing. Each item is
 *  validated — invalid entries are dropped, not the whole array.
 *  Exported so the weekly-test route can reuse the same parser for its
 *  own final-analysis AI response (which has a different prompt but the
 *  same questionExplanations shape). */
export function parseQuestionExplanations(raw: unknown): QuestionExplanation[] {
  if (!Array.isArray(raw)) return [];
  const result: QuestionExplanation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const questionIndex = typeof r.questionIndex === "number" ? r.questionIndex : result.length;
    const question = typeof r.question === "string" ? r.question.trim() : "";
    const studentAnswer = typeof r.studentAnswer === "string" ? r.studentAnswer.trim() : "";
    const correctAnswer = typeof r.correctAnswer === "string" ? r.correctAnswer.trim() : "";
    const explanation = typeof r.explanation === "string" ? r.explanation.trim() : "";
    const encouragement = typeof r.encouragement === "string" ? r.encouragement.trim() : "";
    // Skip entries missing the critical fields
    if (!correctAnswer || !explanation) continue;
    result.push({
      questionIndex,
      question: question || "(question unavailable)",
      studentAnswer: studentAnswer || "(no answer captured)",
      correctAnswer,
      explanation,
      encouragement: encouragement || "Keep practicing — every attempt teaches you something.",
    });
  }
  return result;
}

/**
 * Grade a test using the unified AI grader.
 *
 * Always returns a valid GradeResult — never throws. On AI failure or
 * malformed response, returns fallbackGrade(...) so the student still
 * gets a score + teaching feedback.
 */
export async function gradeTest(input: GradeTestInput): Promise<GradeResult> {
  const { topic, testKind, transcript, includeQuestionExplanations } = input;

  // Estimate engagement from the transcript for the fallback score
  const repliesCount = (transcript.match(/^Student:/gm) || []).length;

  // When per-question explanations are requested, the response is much
  // larger (one block per question). Bump the token budget accordingly.
  const maxTokens = includeQuestionExplanations ? 2500 : 600;

  try {
    const result = await callAI(
      [{ role: "user", content: buildGradePrompt(input) }],
      {
        temperature: 0.4,
        maxTokens,
        feature: `${testKind}-grade`,
      },
    );

    const parsed = parseGradeResponse(result.text, topic, testKind, repliesCount);
    if (parsed) return parsed;

    logger.warn(`${testKind} grading returned unparseable response`, {
      topic,
      textPreview: result.text?.slice(0, 200),
    });
  } catch (err) {
    logger.warn(`${testKind} grading failed`, {
      topic,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return fallbackGrade(topic, testKind, repliesCount);
}
