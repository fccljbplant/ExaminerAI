import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { weeklyTestSystemPrompt } from "@/lib/ai-prompts";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import { getBootcampDayNumber } from "@/lib/course-topics";
import { getAIPrompts } from "@/lib/course-config";
import { logger } from "@/lib/logger";
import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import { trackTestCompletion } from "@/modules/assessment/lib/engagement-tracker";
import { applyPlagiarismDeduction } from "@/lib/plagiarism-scoring";
import { gradeTest, type GradeResult, type QuestionExplanation } from "@/lib/unified-grader";
import { gradeOneQuestion } from "@/modules/assessment/lib/unified-test-engine";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * POST /api/daily-test
 *
 * Phase Three-Tab Redesign — Daily Test.
 *
 * A SHORT Socratic conversation, 2-3 questions, same format as the weekly
 * test. The examiner asks, the student answers, the examiner probes once
 * or twice, then advances. Same rigor, just shorter — feeds the same
 * analysis pipeline so the Psychological/Educational/Mentorship tabs
 * update daily instead of only weekly.
 *
 * Actions:
 *   - start: begin today's test — examiner asks Q1
 *   - reply: student answers, examiner responds + may advance
 *   - finish: student ends early, examiner grades
 *   - status: check if today's test is done
 *
 * Conversation state lives on the DailyTest row:
 *   - conversation: JSON array of { role, content, timestamp, questionIndex }
 *   - currentQuestion: 0-based index
 *   - replyCount: replies on the current question
 *   - status: "in_progress" | "completed" | "skipped"
 */

const TOTAL_QUESTIONS = 3;
const MAX_REPLIES_PER_QUESTION = 2; // examiner probes once, then advances

// Daily test includes both CONCEPTUAL and IMPLEMENTATION questions:
// Q1: Conceptual (what is it?)
// Q2: Implementation (how do you use it?)
// Q3: Applied/edge case (what happens when...?)
const QUESTION_TYPES = [
  "a CONCEPTUAL question about what this topic IS and WHY it matters",
  "an IMPLEMENTATION question about HOW to use this topic in practice (e.g., how would you configure/deploy/use it)",
  "an APPLIED/EDGE-CASE question about what happens in unusual situations or when things go wrong",
];

interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex: number;
  confidenceRating?: "low" | "medium" | "high" | null; // captured before each student answer
  /** Per-question explanation — attached to the examiner's advancing message
   *  so the student sees it immediately when they move on to the next question. */
  questionExplanation?: QuestionExplanation;
}

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can take daily tests" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  const totalWeeks = await getCourseDurationWeeks(user.id);
  const week = Math.min(user.currentWeek, totalWeeks);
  const topics = await getCourseWeekTopicTitles(user.id, week);
  const phase = await getCourseWeekPhase(user.id, week);

  // Pick TODAY's topic based on the current day of the week (1-5 = Mon-Fri).
  // Previously this always used topics[0] (Day 1's topic) for every daily test,
  // which meant the daily test was stuck on Day 1's topic all week — not
  // aligned with what the student was actually studying that day.
  // Now: Monday → topics[0], Tuesday → topics[1], ..., Friday → topics[4].
  // On weekends (day 6-7), default to the last weekday's topic (topics[4]).
  // If the course has fewer topics than the day number, fall back to the last topic.
  const bootcampDay = getBootcampDayNumber(new Date()); // 1=Mon ... 7=Sun
  const dayIndex = Math.min(Math.max(bootcampDay - 1, 0), Math.max(topics.length - 1, 0));
  const todaysTopic = topics[dayIndex] || topics[0] || `Week ${week} material`;

  // ---- ACTION: STATUS ----
  if (action === "status") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todays = await db.dailyTest.findFirst({
      where: { userId: user.id, date: { gte: today, lt: tomorrow } },
      orderBy: { date: "desc" },
      select: { id: true, status: true, score: true, topic: true, questionCount: true, currentQuestion: true, conversation: true },
    });

    if (todays?.status === "completed") {
      let conversation: ChatMessage[] = [];
      try { conversation = JSON.parse(todays.conversation || "[]"); } catch { conversation = []; }
      return NextResponse.json({
        todaysTest: {
          id: todays.id, status: todays.status, score: todays.score,
          topic: todays.topic, questionCount: todays.questionCount,
          conversation, currentQuestion: todays.currentQuestion,
        },
      });
    }
    return NextResponse.json({ todaysTest: todays ? { id: todays.id, status: todays.status, topic: todays.topic, questionCount: todays.questionCount } : null });
  }

  // ---- ACTION: START ----
  if (action === "start") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await db.dailyTest.findFirst({
      where: { userId: user.id, date: { gte: today, lt: tomorrow } },
    });

    if (existing?.status === "completed") {
      return NextResponse.json({
        error: "Today's daily test already completed. Come back tomorrow!",
        alreadyCompleted: true,
        score: existing.score,
      }, { status: 409 });
    }

    // Build the system prompt — same course-aware logic as weekly test
    const [courseMeta, coursePrompts] = await Promise.all([
      getCourseMetadata(user.id),
      getAIPrompts(user.id),
    ]);
    const baseSystemPrompt = coursePrompts.weeklyTestSystemPrompt || weeklyTestSystemPrompt();
    const courseContext = courseMeta
      ? `\nCOURSE CONTEXT:
- Course: ${courseMeta.name} (${courseMeta.domain}, ${courseMeta.level} level)
- Tools: ${courseMeta.toolsUsed.length > 0 ? courseMeta.toolsUsed.join(", ") : "various"}
- Deliverables: ${courseMeta.deliverableTypes.length > 0 ? courseMeta.deliverableTypes.join(", ") : "various"}
Adapt your questions to this course's domain.`
      : "";

    const dailyContext = `
DAILY TEST — SHORTER FORMAT:
- This is a DAILY check-in test, not the full weekly test.
- Ask only ${TOTAL_QUESTIONS} questions total (not 10).
- For each question: ask, let the student answer, probe ONCE if needed (max ${MAX_REPLIES_PER_QUESTION} replies per question), then advance.
- Keep questions shorter than the weekly test — one focused concept per question.
- Same Socratic rigor, just condensed.
- Topic for today: "${todaysTopic}" (Week ${week}, Day ${bootcampDay}, phase: ${phase})
`;

    const SYSTEM_PROMPT = baseSystemPrompt + courseContext + dailyContext;

    // Create or reuse the DailyTest row.
    // Use upsert with the @@unique([userId, date]) constraint to handle
    // race conditions — double-clicking "Start" won't create duplicates.
    const dailyTest = existing
      ? await db.dailyTest.update({
          where: { id: existing.id },
          data: {
            topic: todaysTopic,
            pillar: "concept",
            questionCount: TOTAL_QUESTIONS,
            status: "in_progress",
            currentQuestion: 0,
            replyCount: 0,
            conversation: "[]",
          },
        })
      : await db.dailyTest.upsert({
          where: { userId_date: { userId: user.id, date: today } },
          create: {
            userId: user.id, date: today, week,
            topic: todaysTopic,
            pillar: "concept",
            questionCount: TOTAL_QUESTIONS,
            status: "in_progress",
            currentQuestion: 0,
            replyCount: 0,
            conversation: "[]",
          },
          update: {},
        });

    // Generate the first question
    const context = `Week ${week} (Day ${bootcampDay}): ${phase}. Today's topic: "${todaysTopic}".`;
    const firstMsgRaw = await callAILocal([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nStart the daily test. You are on Question 1 of ${TOTAL_QUESTIONS}. Ask ${QUESTION_TYPES[0]}. Do NOT prefix with "Question 1:" — just ask the question directly.` },
    ], "daily-test-start");

    const firstMsg = firstMsgRaw.replace(/^Question\s*\d+\s*:\s*/i, "").trim();
    const conversation: ChatMessage[] = [{
      role: "examiner", content: firstMsg,
      timestamp: new Date().toISOString(), questionIndex: 0,
    }];

    await db.dailyTest.update({
      where: { id: dailyTest.id },
      data: { conversation: JSON.stringify(conversation) },
    });

    return NextResponse.json({
      dailyTestId: dailyTest.id,
      conversation,
      currentQuestion: 0,
      replyCount: 0,
      totalQuestions: TOTAL_QUESTIONS,
      maxReplies: MAX_REPLIES_PER_QUESTION,
      topic: todaysTopic,
      week,
    });
  }

  // ---- ACTION: REPLY ----
  if (action === "reply") {
    const { dailyTestId, studentReply, confidenceRating } = body as { dailyTestId?: string; studentReply?: string; confidenceRating?: "low" | "medium" | "high" };
    if (!dailyTestId || !studentReply?.trim()) {
      return NextResponse.json({ error: "dailyTestId and studentReply required" }, { status: 400 });
    }
    if (studentReply.length > 8000) {
      return NextResponse.json({ error: "Reply too long (max 8000 characters)" }, { status: 400 });
    }

    const test = await db.dailyTest.findUnique({ where: { id: dailyTestId } });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    if (test.userId !== user.id) return NextResponse.json({ error: "Not your test" }, { status: 403 });
    if (test.status === "completed") {
      return NextResponse.json({ error: "Test already completed" }, { status: 400 });
    }

    let conversation: ChatMessage[] = [];
    try { conversation = JSON.parse(test.conversation || "[]"); } catch { conversation = []; }

    // Add student's reply — with confidence rating if provided (captured BEFORE the answer in the UI)
    const newReplyCount = (test.replyCount ?? 0) + 1;
    conversation.push({
      role: "student", content: studentReply.trim(),
      timestamp: new Date().toISOString(), questionIndex: test.currentQuestion ?? 0,
      confidenceRating: confidenceRating || null,
    });

    // Build system prompt (same as start)
    const [courseMeta, coursePrompts] = await Promise.all([
      getCourseMetadata(user.id),
      getAIPrompts(user.id),
    ]);
    const baseSystemPrompt = coursePrompts.weeklyTestSystemPrompt || weeklyTestSystemPrompt();
    const courseContext = courseMeta
      ? `\nCOURSE CONTEXT: ${courseMeta.name} (${courseMeta.domain}). Tools: ${courseMeta.toolsUsed.join(", ")}.`
      : "";
    const SYSTEM_PROMPT = baseSystemPrompt + courseContext + `\n\nDAILY TEST: ${TOTAL_QUESTIONS} questions total, max ${MAX_REPLIES_PER_QUESTION} replies per question. Topic: "${test.topic}". You are on Question ${(test.currentQuestion ?? 0) + 1} of ${TOTAL_QUESTIONS}. Reply ${newReplyCount} of ${MAX_REPLIES_PER_QUESTION}. Question type: ${QUESTION_TYPES[Math.min(test.currentQuestion ?? 0, QUESTION_TYPES.length - 1)]}.` + `\n\nLANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu (e.g. "zaroori hota hai", "tum kon ho", "karna hai"), your ENTIRE response MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language ("explain in urdu"), comply. NEVER ask them to switch to English. Technical terms (database, API, plugin) stay in English.`;

    // Convert conversation to AI messages
    const aiMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...conversation.map(m => ({
        role: (m.role === "student" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    const examinerResponse = await callAILocal(aiMessages, "daily-test-reply");
    const isLastReply = newReplyCount >= MAX_REPLIES_PER_QUESTION;
    const isLastQuestion = (test.currentQuestion ?? 0) >= TOTAL_QUESTIONS - 1;

    // Advance logic: if last reply on last question → complete. If last reply → advance.
    let nextQuestion = test.currentQuestion ?? 0;
    let nextReplyCount = newReplyCount;
    let isComplete = false;

    if (isLastReply) {
      if (isLastQuestion) {
        isComplete = true;
      } else {
        nextQuestion = (test.currentQuestion ?? 0) + 1;
        nextReplyCount = 0;
      }
    }

    // Per-question explanation: when the examiner advances (or completes),
    // grade the question that JUST ended and attach the explanation to the
    // examiner's advancing message. The student sees it immediately in the
    // chat — they don't have to wait for the whole test to finish.
    let questionExplanation: QuestionExplanation | undefined;
    if (isLastReply) {
      const questionJustEnded = conversation
        .filter(m => m.role === "examiner" && m.questionIndex === (test.currentQuestion ?? 0))
        .map(m => m.content)
        .join(" ");
      const studentAnswersToThisQuestion = conversation
        .filter(m => m.role === "student" && m.questionIndex === (test.currentQuestion ?? 0))
        .map(m => m.content);
      if (questionJustEnded && studentAnswersToThisQuestion.length > 0) {
        questionExplanation = await gradeOneQuestion({
          question: questionJustEnded,
          studentAnswers: studentAnswersToThisQuestion,
          topic: test.topic || `Week ${week} material`,
          testKind: "daily_test",
          studentName: user.name,
        });
      }
    }

    conversation.push({
      role: "examiner", content: examinerResponse,
      timestamp: new Date().toISOString(), questionIndex: nextQuestion,
      questionExplanation,
    });

    if (isComplete) {
      // Grade the test
      const grade = await gradeDailyTest(conversation, test.topic, user.name);
      // Estimate plagiarism from answer patterns (daily test doesn't run
      // the full plagiarism analysis like the weekly test, but we can
      // estimate from answer length variance + vocabulary consistency)
      const plagiarismScore = estimatePlagiarismFromConversation(conversation);
      const plagiarismResult = applyPlagiarismDeduction(grade.score, plagiarismScore);
      await db.dailyTest.update({
        where: { id: test.id },
        data: {
          status: "completed",
          score: plagiarismResult.finalScore, // DEDUCTED score
          conversation: JSON.stringify(conversation),
          currentQuestion: TOTAL_QUESTIONS,
          replyCount: nextReplyCount,
        },
      });

      // Run the analysis pipeline — build answers array from conversation
      const answersForPipeline = buildAnswersFromConversation(conversation, plagiarismResult.finalScore, test.topic);
      void runAnalysisPipeline({
        userId: user.id, testId: test.id, testType: "daily_test",
        week: test.week, score: plagiarismResult.finalScore, topics: [test.topic],
        conversation: conversation.map(m => ({ role: m.role, content: m.content, questionIndex: m.questionIndex })),
        answers: answersForPipeline,
        plagiarismScore,
      }).catch(err => logger.warn("Analysis pipeline failed", { error: err instanceof Error ? err.message : String(err) }));
      void trackTestCompletion({ userId: user.id, score: plagiarismResult.finalScore, testType: "daily_test" });

      // Write a unified ChatSession row (chatbotType="daily_test") so all
      // chatbot sessions live in one model for cross-chatbot analysis.
      // Non-blocking — best-effort.
      db.chatSession.create({
        data: {
          userId: user.id,
          chatbotType: "daily_test",
          week: test.week,
          topic: test.topic,
          status: "completed",
          score: plagiarismResult.finalScore,
          totalQuestions: TOTAL_QUESTIONS,
          currentQuestion: TOTAL_QUESTIONS,
          conversation: JSON.stringify(conversation),
          completedAt: new Date(),
        },
      }).catch(() => {/* Non-blocking — best-effort logging */});

      return NextResponse.json({
        conversation, isComplete: true,
        score: plagiarismResult.finalScore, // DEDUCTED score
        rawScore: plagiarismResult.rawScore,
        plagiarismDeduction: plagiarismResult,
        feedback: grade.feedback,
        currentQuestion: TOTAL_QUESTIONS,
        totalQuestions: TOTAL_QUESTIONS,
        maxReplies: MAX_REPLIES_PER_QUESTION,
        topic: test.topic, week: test.week,
      });
    }

    await db.dailyTest.update({
      where: { id: test.id },
      data: {
        conversation: JSON.stringify(conversation),
        currentQuestion: nextQuestion,
        replyCount: nextReplyCount,
      },
    });

    return NextResponse.json({
      conversation,
      currentQuestion: nextQuestion,
      replyCount: nextReplyCount,
      totalQuestions: TOTAL_QUESTIONS,
      maxReplies: MAX_REPLIES_PER_QUESTION,
      isComplete,
      topic: test.topic, week: test.week,
    });
  }

  // ---- ACTION: FINISH (early) ----
  if (action === "finish") {
    const { dailyTestId } = body as { dailyTestId?: string };
    if (!dailyTestId) return NextResponse.json({ error: "dailyTestId required" }, { status: 400 });

    const test = await db.dailyTest.findUnique({ where: { id: dailyTestId } });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    if (test.userId !== user.id) return NextResponse.json({ error: "Not your test" }, { status: 403 });
    if (test.status === "completed") {
      return NextResponse.json({ error: "Test already completed" }, { status: 400 });
    }

    let conversation: ChatMessage[] = [];
    try { conversation = JSON.parse(test.conversation || "[]"); } catch { conversation = []; }

    const grade = await gradeDailyTest(conversation, test.topic, user.name);
    const plagiarismScore = estimatePlagiarismFromConversation(conversation);
    const plagiarismResult = applyPlagiarismDeduction(grade.score, plagiarismScore);
    await db.dailyTest.update({
      where: { id: test.id },
      data: {
        status: "completed",
        score: plagiarismResult.finalScore,
        conversation: JSON.stringify(conversation),
      },
    });

    const answersForPipeline = buildAnswersFromConversation(conversation, plagiarismResult.finalScore, test.topic);
    void runAnalysisPipeline({
      userId: user.id, testId: test.id, testType: "daily_test",
      week: test.week, score: plagiarismResult.finalScore, topics: [test.topic],
      conversation: conversation.map(m => ({ role: m.role, content: m.content, questionIndex: m.questionIndex })),
      answers: answersForPipeline,
      plagiarismScore,
    }).catch(err => logger.warn("Analysis pipeline failed", { error: err instanceof Error ? err.message : String(err) }));
    void trackTestCompletion({ userId: user.id, score: plagiarismResult.finalScore, testType: "daily_test" });

    return NextResponse.json({
      conversation, isComplete: true,
      score: plagiarismResult.finalScore,
      rawScore: plagiarismResult.rawScore,
      plagiarismDeduction: plagiarismResult,
      feedback: grade.feedback,
      topic: test.topic, week: test.week,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** Call AI via shared provider — catches errors and returns a fallback
 *  prompt so a single AI failure doesn't crash the whole test. */
async function callAILocal(messages: { role: "system" | "user" | "assistant"; content: string }[], feature: string): Promise<string> {
  try {
    const result = await callAI(messages, { temperature: 0.5, maxTokens: TOKEN_BUDGET.WEEKLY_TEST_REPLY, feature });
    if (result.text) return sanitizeExaminerText(result.text);
  } catch (err) {
    logger.warn("Daily test AI call failed", { feature, error: err instanceof Error ? err.message : String(err) });
  }
  return "Can you elaborate on that? Walk me through your reasoning.";
}

/** Strip markdown from examiner responses — plain text only. */
function sanitizeExaminerText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[\-\*_]{3,}\s*$/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^[\-\*]\s+/gm, "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").replace(/```$/g, ""))
    .trim();
}

/** Grade the daily test conversation using the UNIFIED grader
 *  (same modelAnswer + missedPoints + nextTime format as practice & weekly tests). */
async function gradeDailyTest(
  conversation: ChatMessage[],
  topic: string,
  studentName: string,
): Promise<GradeResult> {
  const transcript = conversation
    .filter(m => m.role === "student" || m.content.includes("Observation:") || m.content.includes("Behavior:"))
    .map(m => `${m.role === "student" ? "Student" : "Examiner"}: ${m.content.slice(0, 200)}`)
    .join("\n")
    .slice(0, 1500);

  return gradeTest({
    transcript,
    topic,
    studentName,
    testKind: "daily_test",
    includeQuestionExplanations: true,
  });
}

/** GET /api/daily-test — list daily tests for the student (history). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);

  const tests = await db.dailyTest.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true, date: true, week: true, topic: true, pillar: true,
      questionCount: true, score: true, status: true,
    },
  });

  return NextResponse.json({ tests });
}

/** Build an answers array from the Socratic conversation for the analysis pipeline.
 *
 *  The pipeline's writeConfidenceRatings + writeSkillMastery expect an `answers`
 *  array with per-question { question, answer, score, confidenceRating, topic }.
 *  This function extracts student answers from the conversation, distributes the
 *  overall test score across questions (rough even split), and passes through
 *  any confidence ratings the student provided before each answer.
 */
function buildAnswersFromConversation(
  conversation: ChatMessage[],
  overallScore: number,
  topic: string,
): Array<{ question: string; answer: string; score: number; confidenceRating: "low" | "medium" | "high" | null; topic: string }> {
  // Extract student messages — each one is an "answer"
  const studentMessages = conversation.filter(m => m.role === "student");
  if (studentMessages.length === 0) return [];

  // Find the preceding examiner message for each student message (the "question")
  const answers: Array<{ question: string; answer: string; score: number; confidenceRating: "low" | "medium" | "high" | null; topic: string }> = [];

  for (let i = 0; i < studentMessages.length; i++) {
    const studentMsg = studentMessages[i];
    // Find the last examiner message before this student message
    const studentIdx = conversation.indexOf(studentMsg);
    let questionText = "(question not found)";
    for (let j = studentIdx - 1; j >= 0; j--) {
      if (conversation[j].role === "examiner") {
        questionText = conversation[j].content;
        break;
      }
    }

    answers.push({
      question: questionText,
      answer: studentMsg.content,
      // Distribute the overall score roughly evenly across answers.
      // This is imperfect — a real per-question grade would be better —
      // but it's better than nothing for SkillMastery aggregation.
      score: Math.round(overallScore),
      confidenceRating: studentMsg.confidenceRating || null,
      topic,
    });
  }

  return answers;
}

/** Estimate plagiarism from conversation patterns.
 *  Daily test doesn't run the full AI plagiarism analysis (too expensive),
 *  but we can estimate from answer length variance + vocabulary signals.
 *
 *  Signals:
 *  - Length anomaly: one answer 3x longer than others → +30
 *  - Vocabulary jump: advanced terms in one answer not in others → +20
 *  - AI-typical phrases: "It's important to note", "Furthermore" → +25
 *  - Consistent short answers (no signal) → 0
 */
function estimatePlagiarismFromConversation(conversation: ChatMessage[]): number {
  const studentMsgs = conversation.filter(m => m.role === "student");
  if (studentMsgs.length < 2) return 0;

  const lens = studentMsgs.map(m => m.content.length);
  const avgLen = lens.reduce((a, b) => a + b, 0) / lens.length;
  const maxLen = Math.max(...lens);

  let score = 0;

  // Length anomaly: one answer much longer than others
  if (maxLen > avgLen * 3 && maxLen > 300) {
    score += 30;
  }

  // AI-typical phrases
  const allText = studentMsgs.map(m => m.content.toLowerCase()).join(" ");
  const aiPhrases = ["it's important to note", "furthermore", "additionally", "in essence", "it's worth mentioning", "this means that"];
  const phraseCount = aiPhrases.filter(p => allText.includes(p)).length;
  if (phraseCount >= 2) score += 25;
  else if (phraseCount >= 1) score += 15;

  // Vocabulary jump: check if one answer uses significantly more complex words
  const wordSets = studentMsgs.map(m => new Set(m.content.toLowerCase().split(/\s+/).filter(w => w.length > 8)));
  if (wordSets.length >= 2) {
    const avgComplexWords = wordSets.reduce((a, s) => a + s.size, 0) / wordSets.length;
    const maxComplexWords = Math.max(...wordSets.map(s => s.size));
    if (maxComplexWords > avgComplexWords * 3 && maxComplexWords > 10) {
      score += 20;
    }
  }

  return Math.min(100, score);
}
