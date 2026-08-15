import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { callAIJson } from "@/lib/ai-json";
import { DEFAULT_STATE, nextState, questionDirective, calibrationFlag, type DifficultyState } from "@/lib/assessment/adaptive";
import { recordLearningSignal } from "@/lib/learning-signal";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { weeklyTestSystemPrompt } from "@/lib/ai-prompts";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import { getBootcampDayNumber } from "@/lib/course-topics";
import { getAIPrompts } from "@/lib/course-config";
import { logger } from "@/lib/logger";
import { buildTestLedger, ledgerToPrompt, buildNextQuestionPrompt } from "@/modules/assessment/lib/test-ledger";
import { gradeTest, type GradeResult, type QuestionExplanation } from "@/lib/unified-grader";
import { gradeOneQuestion } from "@/modules/assessment/lib/unified-test-engine";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";
import { awardXP, awardBadge } from "@/modules/gamification";

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

export const maxDuration = 120; // ledger-based turns stay small; grading gets headroom
const TOTAL_QUESTIONS = 3;
const MAX_REPLIES_PER_QUESTION = 2; // examiner probes once, then advances

interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex: number;
  confidenceRating?: "low" | "medium" | "high" | null;
  selfConfidence?: "sure" | "guessing" | null; // NEW: explicit confidence tap
  questionExplanation?: QuestionExplanation;
  degraded?: boolean; // NEW: marks AI-failed responses
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("submitting daily tests"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only students can take daily tests" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  // H1 fix: enforce per-user daily AI rate limit + demo block
  const isDemo = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  const blocked = await enforceAIRateLimit(user.id, action === "reply" ? "daily-test-reply" : "daily-test", isDemo);
  if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

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

    // Generate the first question using adaptive difficulty
    const context = `Week ${week} (Day ${bootcampDay}): ${phase}. Today's topic: "${todaysTopic}".`;
    const diffState: DifficultyState = DEFAULT_STATE;
    const firstMsgResult = await callAILocal([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nStart the daily test. You are on Question 1 of ${TOTAL_QUESTIONS}. ${questionDirective(diffState.level)} Do NOT prefix with "Question 1:" — just ask the question directly.` },
    ], "daily-test-start", user.id);

    const firstMsg = firstMsgResult.text.replace(/^Question\s*\d+\s*:\s*/i, "").trim();
    const conversation: ChatMessage[] = [{
      role: "examiner", content: firstMsg,
      timestamp: new Date().toISOString(), questionIndex: 0,
      degraded: firstMsgResult.degraded,
    }];

    // Store initial difficulty state
    await db.dailyTest.update({
      where: { id: dailyTest.id },
      data: {
        conversation: JSON.stringify(conversation),
        difficultyState: JSON.stringify(diffState),
      },
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
    const { dailyTestId, studentReply, confidenceRating, selfConfidence } = body as { dailyTestId?: string; studentReply?: string; confidenceRating?: "low" | "medium" | "high"; selfConfidence?: "sure" | "guessing" };
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
      selfConfidence: selfConfidence || null,
    });

    // Read adaptive difficulty state from the test row
    let diffState: DifficultyState = DEFAULT_STATE;
    try { diffState = JSON.parse(test.difficultyState || ""); } catch { diffState = DEFAULT_STATE; }

    // Build system prompt (same as start)
    const [courseMeta, coursePrompts] = await Promise.all([
      getCourseMetadata(user.id),
      getAIPrompts(user.id),
    ]);
    const baseSystemPrompt = coursePrompts.weeklyTestSystemPrompt || weeklyTestSystemPrompt();
    const courseContext = courseMeta
      ? `\nCOURSE CONTEXT: ${courseMeta.name} (${courseMeta.domain}). Tools: ${courseMeta.toolsUsed.join(", ")}.`
      : "";
    const SYSTEM_PROMPT = baseSystemPrompt + courseContext + `\n\nDAILY TEST: ${TOTAL_QUESTIONS} questions total, max ${MAX_REPLIES_PER_QUESTION} replies per question. Topic: "${test.topic}". You are on Question ${(test.currentQuestion ?? 0) + 1} of ${TOTAL_QUESTIONS}. Reply ${newReplyCount} of ${MAX_REPLIES_PER_QUESTION}. ${questionDirective(diffState.level)}` + `\n\nLANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu (e.g. "zaroori hota hai", "tum kon ho", "karna hai"), your ENTIRE response MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language ("explain in urdu"), comply. NEVER ask them to switch to English. Technical terms (database, API, plugin) stay in English.`;

    // Convert conversation to the COMPACT LEDGER (2026-08-15): the AI
    // never sees the raw history — one bounded line per completed
    // question + the current question + the latest answer. Long sessions
    // can no longer make these calls time out.
    const ledger = buildTestLedger(conversation);
    const ledgerText = ledgerToPrompt(ledger);
    const currentQuestionText = (conversation
      .filter(m => m.role === "examiner" && m.questionIndex === (test.currentQuestion ?? 0))
      .map(m => m.content)
      .join(" ")
      || `the topic "${test.topic}"`).slice(0, 400);

    const aiMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `TEST LEDGER (completed questions, compact):
${ledgerText}

CURRENT QUESTION (${(test.currentQuestion ?? 0) + 1} of ${TOTAL_QUESTIONS}): "${currentQuestionText}"
The student just answered (reply ${newReplyCount} of ${MAX_REPLIES_PER_QUESTION}): "${studentReply.slice(0, 800)}"

Give 1-2 sentences of brief feedback on the student's answer. Then decide:
- If the answer was clear enough to assess: end your reply there — the next question is generated separately.
- If it's too unclear or brief: ask ONE brief probing follow-up about the SAME topic.
- If off-topic or pasting the question back: redirect firmly, do NOT praise it.

CRITICAL RULES:
- Do NOT ask the next question in this reply — it is generated separately.
- Do NOT repeat sentences. Keep feedback under 3 sentences.
- Do NOT explain concepts in detail. You are testing, not teaching.`,
      },
    ];

    const examinerResult = await callAILocal(aiMessages, "daily-test-reply", user.id);
    const examinerResponse = examinerResult.text;
    const isDegraded = examinerResult.degraded;
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

    // Per-question explanation + AUTO-NEXT-QUESTION (2026-08-15): when the
    // examiner advances, the question that just ended is graded AND the
    // next question is generated by its OWN AI call — in parallel. The
    // next question is appended as its own message so the student sees it
    // immediately without sending anything.
    let questionExplanation: QuestionExplanation | undefined;
    let autoNextQuestion: string | null = null;
    if (isLastReply && !isLastQuestion) {
      const questionJustEnded = conversation
        .filter(m => m.role === "examiner" && m.questionIndex === (test.currentQuestion ?? 0))
        .map(m => m.content)
        .join(" ");
      const studentAnswersToThisQuestion = conversation
        .filter(m => m.role === "student" && m.questionIndex === (test.currentQuestion ?? 0))
        .map(m => m.content);
      const [explanation, nextQ] = await Promise.all([
        questionJustEnded && studentAnswersToThisQuestion.length > 0
          ? gradeOneQuestion({
              question: questionJustEnded,
              studentAnswers: studentAnswersToThisQuestion,
              topic: test.topic || `Week ${week} material`,
              testKind: "daily_test",
              studentName: user.name,
            })
          : Promise.resolve(undefined),
        generateNextDailyQuestion({
          systemPrompt: SYSTEM_PROMPT,
          ledgerText,
          questionNumber: (test.currentQuestion ?? 0) + 2,
          totalQuestions: TOTAL_QUESTIONS,
          topic: test.topic,
        }),
      ]);
      questionExplanation = explanation;
      autoNextQuestion = nextQ;
    } else if (isLastReply && isLastQuestion) {
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

    // ADAPTIVE: update difficulty state based on the graded answer
    if (questionExplanation) {
      const selfConf = selfConfidence as "sure" | "guessing" | undefined;
      if (selfConf) {
        diffState = nextState(diffState, { score: questionExplanation.score, selfConfidence: selfConf });
        const flag = calibrationFlag({ score: questionExplanation.score, selfConfidence: selfConf });
        if (flag !== "calibrated") {
          logger.info("calibration", { userId: user.id, flag, score: questionExplanation.score });
        }
      }

      // MISTAKE REPLAY: weak answers become spaced drill cards
      if (questionExplanation.score < 60) {
        const studentAnswer = conversation
          .filter(m => m.role === "student" && m.questionIndex === (test.currentQuestion ?? 0))
          .map(m => m.content)
          .join(" ")
          .slice(0, 200);
        db.drillCard.create({
          data: {
            userId: user.id,
            topic: test.topic || "general",
            questionDigest: studentAnswer,
            explanation: questionExplanation.explanation ?? "",
            dueAt: new Date(Date.now() + 2 * 86400_000), // due in 2 days
            attempts: 0,
            lastScore: questionExplanation.score,
          },
        }).catch((err) => { logger.warn("Operation failed", { err }); });
      }
    }

    // Feedback reply for the question that just ended (tagged with its
    // index + explanation), then the AUTO-generated next question as its
    // OWN message (2026-08-15) — the student sees it without sending.
    if (!isComplete) {
      conversation.push({
        role: "examiner", content: examinerResponse,
        timestamp: new Date().toISOString(), questionIndex: test.currentQuestion ?? 0,
        questionExplanation,
        degraded: isDegraded,
      });
      if (autoNextQuestion) {
        conversation.push({
          role: "examiner", content: autoNextQuestion,
          timestamp: new Date().toISOString(), questionIndex: nextQuestion,
        });
      }
    } else {
      conversation.push({
        role: "examiner", content: examinerResponse,
        timestamp: new Date().toISOString(), questionIndex: test.currentQuestion ?? 0,
        questionExplanation,
        degraded: isDegraded,
      });
    }

    if (isComplete) {
      // Grade the test — AI DOES ALL CALCULATIONS (2026-08-15): the
      // grader receives the compact ledger + a plagiarism-risk hint and
      // returns the FINAL score (deduction already applied). The app
      // only clamps, stores and displays.
      const plagiarismScore = estimatePlagiarismFromConversation(conversation);
      const grade = await gradeDailyTest(conversation, test.topic, user.name, {
        plagiarismSignal: plagiarismScore,
        answered: conversation.filter(m => m.role === "student").reduce(
          (set, m) => (set.add(typeof m.questionIndex === "number" ? m.questionIndex : -1), set),
          new Set<number>(),
        ).size,
        total: TOTAL_QUESTIONS,
      });
      const finalScore = Math.max(0, Math.min(100, grade.score));
      const rawScore = Math.max(0, Math.min(100, grade.rawScore ?? grade.score));
      const plagiarismResult = {
        rawScore,
        plagiarismScore,
        deductedMarks: Math.max(0, rawScore - finalScore),
        finalScore,
        deductionPercent: plagiarismScore,
      };
      await db.dailyTest.update({
        where: { id: test.id },
        data: {
          status: "completed",
          score: finalScore, // AI-computed FINAL score (deduction applied)
          conversation: JSON.stringify(conversation),
          currentQuestion: TOTAL_QUESTIONS,
          replyCount: nextReplyCount,
          difficultyState: JSON.stringify(diffState),
        },
      });

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
      }).catch((err) => { logger.warn("Operation failed", { err }); });

      // MODERNIZED: transparent Learning Signal replaces the deleted psych pipeline
      void recordLearningSignal(user.id).catch((err) => { logger.warn("Operation failed", { err }); });

      // ── Evidence-Locked XP + Badges (natural completion path) ────
      const celebrationNat = { xpAwarded: 0, newTotal: 0, level: null as number | null, levelLabel: null as string | null, badges: [] as Array<{ id: string; name: string; icon: string; description: string }> };
      try {
        const finalScoreNat = plagiarismResult.finalScore;
        if (finalScoreNat >= 60) {
          const xpResult = await awardXP({ userId: user.id, reason: "DAILY_TEST_PASSED", refId: test.id });
          if (xpResult) {
            celebrationNat.xpAwarded += xpResult.awarded;
            celebrationNat.newTotal = xpResult.newTotal;
            celebrationNat.level = xpResult.level.level;
            celebrationNat.levelLabel = xpResult.level.label;
          }
          if (finalScoreNat >= 90) {
            const aceResult = await awardXP({ userId: user.id, reason: "DAILY_TEST_ACED", refId: test.id });
            if (aceResult) {
              celebrationNat.xpAwarded += aceResult.awarded;
              celebrationNat.newTotal = aceResult.newTotal;
              celebrationNat.level = aceResult.level.level;
              celebrationNat.levelLabel = aceResult.level.label;
            }
          }
        }
        const firstBadgeNat = await awardBadge({ userId: user.id, badgeId: "first_test" });
        if (firstBadgeNat?.newlyAwarded) {
          celebrationNat.badges.push({ id: firstBadgeNat.badge.id, name: firstBadgeNat.badge.name, icon: firstBadgeNat.badge.icon, description: firstBadgeNat.badge.description });
        }
        if (finalScoreNat >= 100) {
          const perfectBadgeNat = await awardBadge({ userId: user.id, badgeId: "perfect_daily" });
          if (perfectBadgeNat?.newlyAwarded) {
            celebrationNat.badges.push({ id: perfectBadgeNat.badge.id, name: perfectBadgeNat.badge.name, icon: perfectBadgeNat.badge.icon, description: perfectBadgeNat.badge.description });
          }
        }
      } catch (err) {
        logger.warn("Daily test XP/badge award failed (natural)", { userId: user.id, testId: test.id, error: err instanceof Error ? err.message : String(err) });
      }

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
        difficulty: diffState,
        celebration: celebrationNat,
      });
    }

    await db.dailyTest.update({
      where: { id: test.id },
      data: {
        conversation: JSON.stringify(conversation),
        currentQuestion: nextQuestion,
        replyCount: nextReplyCount,
        difficultyState: JSON.stringify(diffState),
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
      difficulty: diffState,
      degraded: isDegraded,
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

    // Read adaptive difficulty state from the test row
    let diffState: DifficultyState = DEFAULT_STATE;
    try { diffState = JSON.parse(test.difficultyState || ""); } catch { diffState = DEFAULT_STATE; }

    // AI DOES ALL CALCULATIONS (2026-08-15): the grader receives the
    // compact ledger + a plagiarism-risk hint and returns the FINAL
    // score (deduction already applied). The app only stores/displays.
    const plagiarismScore = estimatePlagiarismFromConversation(conversation);
    const grade = await gradeDailyTest(conversation, test.topic, user.name, {
      plagiarismSignal: plagiarismScore,
      answered: conversation.filter(m => m.role === "student").reduce(
        (set, m) => (set.add(typeof m.questionIndex === "number" ? m.questionIndex : -1), set),
        new Set<number>(),
      ).size,
      total: TOTAL_QUESTIONS,
    });
    const finalScore = Math.max(0, Math.min(100, grade.score));
    const rawScore = Math.max(0, Math.min(100, grade.rawScore ?? grade.score));
    const plagiarismResult = {
      rawScore,
      plagiarismScore,
      deductedMarks: Math.max(0, rawScore - finalScore),
      finalScore,
      deductionPercent: plagiarismScore,
    };
    await db.dailyTest.update({
      where: { id: test.id },
      data: {
        status: "completed",
        score: finalScore,
        conversation: JSON.stringify(conversation),
        difficultyState: JSON.stringify(diffState),
      },
    });

    // MODERNIZED: transparent Learning Signal replaces the deleted psych pipeline
    void recordLearningSignal(user.id).catch((err) => { logger.warn("Operation failed", { err }); });

    // ── Evidence-Locked XP + Badges ──────────────────────────────
    // Award XP + badges and COLLECT the results so we can return them
    // to the client. The client uses these to fire celebration animations.
    interface CelebrationData {
      xpAwarded: number;
      newTotal: number;
      level: number | null;
      levelLabel: string | null;
      badges: Array<{ id: string; name: string; icon: string; description: string }>;
    }
    const celebration: CelebrationData = { xpAwarded: 0, newTotal: 0, level: null, levelLabel: null, badges: [] };
    try {
      const finalScore = plagiarismResult.finalScore;
      if (finalScore >= 60) {
        const xpResult = await awardXP({ userId: user.id, reason: "DAILY_TEST_PASSED", refId: test.id });
        if (xpResult) {
          celebration.xpAwarded += xpResult.awarded;
          celebration.newTotal = xpResult.newTotal;
          celebration.level = xpResult.level.level;
          celebration.levelLabel = xpResult.level.label;
        }
        if (finalScore >= 90) {
          const aceResult = await awardXP({ userId: user.id, reason: "DAILY_TEST_ACED", refId: test.id });
          if (aceResult) {
            celebration.xpAwarded += aceResult.awarded;
            celebration.newTotal = aceResult.newTotal;
            celebration.level = aceResult.level.level;
            celebration.levelLabel = aceResult.level.label;
          }
        }
      }
      // Badge: first daily test
      const firstBadge = await awardBadge({ userId: user.id, badgeId: "first_test" });
      if (firstBadge?.newlyAwarded) {
        celebration.badges.push({ id: firstBadge.badge.id, name: firstBadge.badge.name, icon: firstBadge.badge.icon, description: firstBadge.badge.description });
      }
      // Badge: perfect daily score
      if (finalScore >= 100) {
        const perfectBadge = await awardBadge({ userId: user.id, badgeId: "perfect_daily" });
        if (perfectBadge?.newlyAwarded) {
          celebration.badges.push({ id: perfectBadge.badge.id, name: perfectBadge.badge.name, icon: perfectBadge.badge.icon, description: perfectBadge.badge.description });
        }
      }
    } catch (err) {
      logger.warn("Daily test XP/badge award failed", { userId: user.id, testId: test.id, error: err instanceof Error ? err.message : String(err) });
    }

    return NextResponse.json({
      conversation, isComplete: true,
      score: plagiarismResult.finalScore,
      rawScore: plagiarismResult.rawScore,
      plagiarismDeduction: plagiarismResult,
      feedback: grade.feedback,
      topic: test.topic, week: test.week,
      difficulty: diffState,
      celebration, // XP + badge data for client-side animations
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** Schema for the examiner's turn — structured output replaces raw text + sanitizer */
const ExaminerTurnSchema = z.object({
  text: z.string().min(1).max(900),
});

/** Call AI via JSON mode — returns visible degraded flag on failure.
 *  No more silent canned "Can you elaborate?" fallbacks. */
/** AUTO-NEXT-QUESTION (2026-08-15): the next question is generated by
 *  its OWN small AI call — compact ledger + next topic, bounded size,
 *  so a long session can never make this call time out. */
async function generateNextDailyQuestion(args: {
  systemPrompt: string;
  ledgerText: string;
  questionNumber: number;
  totalQuestions: number;
  topic: string;
}): Promise<string> {
  try {
    const result = await callAIJson<{ text: string }>(
      buildNextQuestionPrompt({ ...args, weekLabel: "" }),
      {
        schema: z.object({ text: z.string().min(1).max(400) }),
        feature: "daily-test-next-question",
        temperature: 0.6,
        maxTokens: 200,
      },
    );
    if (result.ok && result.data.text.trim()) {
      return result.data.text.replace(/^Question\s*\d+\s*:\s*/im, "").trim();
    }
  } catch (err) {
    logger.warn("daily next-question generation failed", { error: err instanceof Error ? err.message : String(err) });
  }
  return `Now tell me about "${args.topic}" — what do you remember from today's lesson?`;
}

async function callAILocal(messages: { role: "system" | "user" | "assistant"; content: string }[], feature: string, userId?: string): Promise<{ text: string; degraded: boolean }> {
  const result = await callAIJson<{ text: string }>(messages, {
    schema: ExaminerTurnSchema,
    feature,
    userId,
    temperature: 0.5,
    maxTokens: 800,
  });
  if (result.ok) {
    return { text: result.data.text, degraded: false };
  }
  // VISIBLE degraded mode — the UI shows "AI temporarily unavailable"
  return { text: "The examiner is temporarily unavailable. Your answer was saved — tap retry.", degraded: true };
}

/** Grade the daily test conversation using the UNIFIED grader
 *  (same modelAnswer + missedPoints + nextTime format as practice & weekly tests). */
async function gradeDailyTest(
  conversation: ChatMessage[],
  topic: string,
  studentName: string,
  options?: { plagiarismSignal?: number; answered?: number; total?: number },
): Promise<GradeResult> {
  // The grader receives the COMPACT LEDGER (not the raw transcript) so
  // the final call stays small no matter how long the session ran. All
  // calculations (skip-scaling + plagiarism deduction) happen inside the
  // AI — the app only stores and displays the result.
  const ledger = ledgerToPrompt(buildTestLedger(conversation));
  const stats =
    options && options.total
      ? `Unanswered questions count as 0 — the student answered ${options.answered ?? 0} of ${options.total} questions.`
      : "";
  const transcript = `${ledger}\n\n${stats}`;

  return gradeTest({
    transcript,
    topic,
    studentName,
    testKind: "daily_test",
    includeQuestionExplanations: true,
    plagiarismSignal: options?.plagiarismSignal,
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
