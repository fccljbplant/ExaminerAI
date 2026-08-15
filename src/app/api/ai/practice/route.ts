import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { weeklyTestSystemPrompt } from "@/lib/ai-prompts";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseMetadata, getCourseDurationWeeks } from "@/lib/course-db";
import { getBootcampDayNumber } from "@/lib/course-topics";
import { getAIPrompts } from "@/lib/course-config";
import { logger } from "@/lib/logger";
import { gradeTest, type GradeResult, type QuestionExplanation } from "@/lib/unified-grader";
import { gradeOneQuestion } from "@/modules/assessment/lib/unified-test-engine";
import { pseudonym } from "@/modules/ai";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * POST /api/ai/practice — Socratic practice conversation.
 *
 * Mirrors the daily/weekly test format but for practice:
 *   - Student picks a topic from the week's outline
 *   - AI asks a Socratic question
 *   - Student answers
 *   - AI probes with a follow-up (like the examiner in weekly test)
 *   - After 2-3 exchanges, AI grades the conversation
 *
 * Actions:
 *   - start: generate first question
 *   - reply: student answers, AI responds + may probe or conclude
 *   - finish: end early, grade what we have
 */

interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  /** Per-question explanation — attached to the examiner's final reply
   *  of each question so the student sees it immediately. */
  questionExplanation?: QuestionExplanation;
}

const MAX_EXCHANGES = 3; // 3 questions max (like daily test)

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations"); if (_demoBlock) return _demoBlock;
  const { isFeatureEnabled } = await import("@/lib/feature-flags");
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only students can use practice" }, { status: 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const { isDemoAIBlocked, checkUserAILimit, categoryForFeature } = await import("@/lib/ai-rate-limits");
  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (admin-configurable, default 50/day for test category)
  const category = categoryForFeature("practice");
  const limit = await checkUserAILimit(user.id, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI test limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
      category,
      used: limit.used,
      limit: limit.limit,
      resetAt: limit.resetAt.toISOString(),
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const { topic, pillar, conversation: existingConversation, exchangeCount, week: requestedWeek } = body as {
    topic?: string;
    pillar?: string;
    conversation?: ChatMessage[];
    exchangeCount?: number;
    week?: number;
  };
  // Input length caps
  if (topic && topic.length > 500) {
    return NextResponse.json({ error: "Topic too long (max 500 characters)" }, { status: 400 });
  }

  const totalWeeks = await getCourseDurationWeeks(user.id);
  // Use the requested week if provided + valid (lets students practice on any
  // week in the course — past or future). Falls back to the student's current week.
  const week = (requestedWeek && Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= totalWeeks)
    ? requestedWeek
    : Math.min(user.currentWeek, totalWeeks);
  const topics = await getCourseWeekTopicTitles(user.id, week);
  const phase = await getCourseWeekPhase(user.id, week);
  const bootcampDay = getBootcampDayNumber(new Date());
  const dayIndex = Math.min(Math.max(bootcampDay - 1, 0), Math.max(topics.length - 1, 0));
  const practiceTopic = topic || topics[dayIndex] || topics[0] || `Week ${week} material`;

  // Build system prompt (course-aware, same as weekly test)
  const [courseMeta, coursePrompts] = await Promise.all([
    getCourseMetadata(user.id),
    getAIPrompts(user.id),
  ]);
  const baseSystemPrompt = coursePrompts.weeklyTestSystemPrompt || weeklyTestSystemPrompt();
  const courseContext = courseMeta
    ? `\nCOURSE CONTEXT: ${courseMeta.name} (${courseMeta.domain}). Tools: ${courseMeta.toolsUsed.join(", ")}.`
    : "";
  const SYSTEM_PROMPT = baseSystemPrompt + courseContext + `\n\nPRACTICE MODE: This is a PRACTICE conversation, not a graded test. Ask ONE question about "${practiceTopic}", let the student answer, then probe with ONE follow-up. After ${MAX_EXCHANGES} exchanges, wrap up with encouragement. Keep it conversational and supportive.`;

  // ---- ACTION: START ----
  if (action === "start") {
    const prompt = `Week ${week}: ${phase}. Topic: "${practiceTopic}". Start a practice conversation. Ask a focused conceptual question about this topic. Do NOT prefix with "Question:" — just ask directly. Make it beginner-friendly.`;

    try {
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ], { temperature: 0.7, maxTokens: TOKEN_BUDGET.WEEKLY_TEST_REPLY, feature: "practice-start", userId: user.id });

      const firstQuestion = sanitizeExaminerText(result.text || "") || "Can you explain what you know about " + practiceTopic + "?";
      const conversation: ChatMessage[] = [{
        role: "examiner", content: firstQuestion,
        timestamp: new Date().toISOString(),
      }];

      return NextResponse.json({
        conversation,
        topic: practiceTopic,
        week,
        exchangeCount: 0,
        maxExchanges: MAX_EXCHANGES,
      });
    } catch (err) {
      logger.error("Practice start failed", { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: "Failed to start practice" }, { status: 500 });
    }
  }

  // ---- ACTION: REPLY ----
  if (action === "reply") {
    const studentReply = body.studentReply as string;
    if (!studentReply?.trim()) {
      return NextResponse.json({ error: "studentReply required" }, { status: 400 });
    }
    if (studentReply.length > 8000) {
      return NextResponse.json({ error: "Reply too long (max 8000 characters)" }, { status: 400 });
    }

    // Copy the array — never mutate the request body's array in place.
    const conversation: ChatMessage[] = [...(existingConversation || [])];
    const currentExchange = exchangeCount ?? 0;
    const newExchangeCount = currentExchange + 1;

    conversation.push({
      role: "student", content: studentReply.trim(),
      timestamp: new Date().toISOString(),
    });

    // Determine if we should probe or conclude
    const isLastExchange = newExchangeCount >= MAX_EXCHANGES;
    const LANGUAGE_CHECK = `[LANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu (e.g. "zaroori hota hai", "tum kon ho", "karna hai"), your ENTIRE response MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language ("explain in urdu"), comply. NEVER ask them to switch to English. Technical terms stay in English.]`;
    const contextPrompt = isLastExchange
      ? `${LANGUAGE_CHECK}\n\nThis is the final exchange (${newExchangeCount}/${MAX_EXCHANGES}). Give brief feedback on their answer, then wrap up the practice with an encouraging note. Don't ask another question.`
      : `${LANGUAGE_CHECK}\n\nExchange ${newExchangeCount}/${MAX_EXCHANGES}. Give brief feedback (1 sentence), then ask a follow-up probing question to deepen their understanding.`;

    const aiMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT + `\n${contextPrompt}` },
      ...conversation.map(m => ({
        role: (m.role === "student" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    try {
      const result = await callAI(aiMessages, {
        temperature: 0.5, maxTokens: TOKEN_BUDGET.WEEKLY_TEST_REPLY, feature: "practice-reply", userId: user.id,
      });
      const examinerResponse = sanitizeExaminerText(result.text || "") || "Can you elaborate on that?";

      // Per-question explanation + conversation grade (2026-08-15):
      // both graders are independent of each other — run them in
      // PARALLEL to cut the last-exchange latency in half. Names are
      // pseudonyms — no personal data goes to the AI.
      const studentLabel = pseudonym(user.id);
      let questionExplanation: QuestionExplanation | undefined;
      let grade: GradeResult | null = null;
      if (isLastExchange) {
        const questionText = conversation.find(m => m.role === "examiner")?.content || practiceTopic;
        const studentAnswers = conversation.filter(m => m.role === "student").map(m => m.content);
        const [explanation, conversationGrade] = await Promise.all([
          questionText && studentAnswers.length > 0
            ? gradeOneQuestion({
                question: questionText,
                studentAnswers,
                topic: practiceTopic,
                testKind: "practice",
                studentName: studentLabel,
              })
            : Promise.resolve(undefined),
          gradeConversation(conversation, practiceTopic, studentLabel),
        ]);
        questionExplanation = explanation;
        grade = conversationGrade;
      }

      conversation.push({
        role: "examiner", content: examinerResponse,
        timestamp: new Date().toISOString(),
        questionExplanation,
      });

      // If last exchange, grade the conversation
      if (isLastExchange && grade) {

        // Write a unified ChatSession row (chatbotType="practice") so all
        // chatbot sessions live in one model for cross-chatbot analysis.
        // Non-blocking — best-effort.
        db.chatSession.create({
          data: {
            userId: user.id,
            chatbotType: "practice",
            week,
            topic: practiceTopic,
            status: "completed",
            score: grade.score,
            totalQuestions: MAX_EXCHANGES,
            currentQuestion: MAX_EXCHANGES,
            conversation: JSON.stringify(conversation),
            completedAt: new Date(),
          },
        }).catch((err) => { logger.warn("Operation failed", { err }); });

        return NextResponse.json({
          conversation,
          isComplete: true,
          score: grade.score,
          feedback: grade.feedback,
          exchangeCount: newExchangeCount,
          maxExchanges: MAX_EXCHANGES,
          topic: practiceTopic,
          week,
        });
      }

      return NextResponse.json({
        conversation,
        isComplete: false,
        exchangeCount: newExchangeCount,
        maxExchanges: MAX_EXCHANGES,
        topic: practiceTopic,
        week,
      });
    } catch (err) {
      logger.error("Practice reply failed", { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: "Failed to respond" }, { status: 500 });
    }
  }

  // ---- ACTION: FINISH (early) ----
  if (action === "finish") {
    const conversation: ChatMessage[] = existingConversation || [];
    const grade = await gradeConversation(conversation, practiceTopic, user.name);

    return NextResponse.json({
      conversation,
      isComplete: true,
      score: grade.score,
      feedback: grade.feedback,
      topic: practiceTopic,
      week,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** Grade the practice conversation using the UNIFIED grader
 *  (same modelAnswer + missedPoints + nextTime format as daily & weekly tests). */
async function gradeConversation(
  conversation: ChatMessage[],
  topic: string,
  studentName: string,
): Promise<GradeResult> {
  const transcript = conversation
    .filter(m => m.role === "student")
    .map(m => m.content)
    .join("\n")
    .slice(0, 1000);

  return gradeTest({
    transcript,
    topic,
    studentName,
    testKind: "practice",
  });
}
