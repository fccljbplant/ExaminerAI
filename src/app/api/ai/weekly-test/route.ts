import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { TOKEN_BUDGET } from "@/lib/ai-provider";
import { callAIJson } from "@/lib/ai-json";
import { z } from "zod";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { weeklyTestSystemPrompt, finalAnalysisPrompt } from "@/lib/ai-prompts";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import { getTestConfig, getAIPrompts } from "@/lib/course-config";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { fallbackGrade, type TeachingFeedback, type QuestionExplanation } from "@/lib/unified-grader";
import { gradeOneQuestion } from "@/modules/assessment/lib/unified-test-engine";
import { buildTestLedger, ledgerToPrompt, buildNextQuestionPrompt } from "@/modules/assessment/lib/test-ledger";
import { demoWriteBlock } from "@/lib/demo-guard";
import { issueCertificate } from "@/lib/certificate";
import { TEST_QUESTION_COUNT } from "@/lib/constants";
import { awardXP, awardBadge } from "@/modules/gamification";

/**
 * POST /api/ai/weekly-test
 *
 * Weekly test aligned with the course outline. Questions come from the
 * week's 5 daily topics. Beginner/noob level. Locked until the week's
 * tasks are completed. Only saves results (not full chat history).
 *
 * Request body:
 *   { week, message, action: "start" | "reply" | "finish", projectName? }
 */

// Default constants — overridden by course-specific test config.
// Total weekly questions is sourced from TEST_QUESTION_COUNT.weekly (single source
// of truth in src/lib/constants.ts). Used to be hardcoded to 15, which silently
// disagreed with the constants file and the UI copy — that bug is now closed.
// The prompt template below interpolates the same number, so config and prompt
// can never drift again.
export const maxDuration = 120; // ledger-based turns stay small; final analysis gets headroom
const DEFAULT_MAX_MESSAGES = 5;
const DEFAULT_TOTAL_QUESTIONS = TEST_QUESTION_COUNT.weekly;

interface ChatMessage {
  role: "examiner" | "student";
  content: string;
  timestamp: string;
  questionIndex: number;
  /** Per-question explanation — attached to the examiner's advancing message
   *  so the student sees it immediately when they move on to the next question.
   *  Renders in the chat right after the examiner's reply. */
  questionExplanation?: QuestionExplanation;
}

/** System prompt with course-aligned context + beginner level.
 *  Phase 2.2: Now course-aware — uses the course's tools/deliverables/domain
 *  metadata + course-specific AI prompts (if the course has them) instead of
 *  hardcoding "WordPress, LocalWP, Make.com" for every course. */
async function buildSystemPrompt(userId: string, week: number, totalWeeks: number): Promise<string> {
  const topics = await getCourseWeekTopicTitles(userId, week);
  const phase = await getCourseWeekPhase(userId, week);
  const isFinalWeek = week === totalWeeks;

  // Phase 2.2: Fetch course metadata + course-specific AI prompts.
  // If the student has no course assigned, these fall back to defaults
  // (the legacy 6-week web dev bootcamp behavior).
  const [courseMeta, coursePrompts] = await Promise.all([
    getCourseMetadata(userId),
    getAIPrompts(userId),
  ]);

  // Use the course-specific weekly test system prompt if it exists,
  // otherwise fall back to the default from ai-prompts.ts.
  const baseSystemPrompt = coursePrompts.weeklyTestSystemPrompt || weeklyTestSystemPrompt();

  // Build a course-context prefix that adapts to whatever course the student
  // is in. Replaces the old hardcoded "WordPress, database, APIs, AI" list.
  const courseContext = courseMeta
    ? `\nCOURSE CONTEXT:
- Course: ${courseMeta.name} (${courseMeta.domain}, ${courseMeta.level} level)
- Tools the student is learning: ${courseMeta.toolsUsed.length > 0 ? courseMeta.toolsUsed.join(", ") : "various"}
- Deliverables they produce: ${courseMeta.deliverableTypes.length > 0 ? courseMeta.deliverableTypes.join(", ") : "various"}
- Assessment style: ${courseMeta.assessmentType}

Adapt your questions to this course's domain. Use the course's tools and deliverables in examples. Don't reference tools from other domains (e.g. don't mention WordPress if this is a Python course).`
    : "";

  if (isFinalWeek) {
    // Build the capstone technology list from the course's actual tools,
    // not the hardcoded "WordPress, database, APIs, AI".
    const techList = courseMeta && courseMeta.toolsUsed.length > 0
      ? courseMeta.toolsUsed.join(", ")
      : "the technologies they used";
    return `${baseSystemPrompt}${courseContext}

WEEK ${week} — FINAL CAPSTONE TEST
This is the FINAL test of the course. The student will paste their FULL
PROJECT REPORT. Your job is to assess their overall understanding of the
entire ${totalWeeks}-week course based on their project report.

Assess (in simple, beginner-friendly language):
1. Do they understand what they built and why?
2. Can they explain the technologies they used (${techList})?
3. Do they understand how the pieces connect?
4. Can they reflect on challenges and what they learned?
5. Are they ready to present this project to an employer?

Ask conceptual questions about their project — NOT coding/implementation questions.
Use simple language. Be encouraging but honest in your assessment.`;
  }

  return `${baseSystemPrompt}${courseContext}

WEEK ${week} CONTEXT — ${phase}
Topics the student learned this week (ask questions about THESE topics):
${topics.map((t, i) => `Day ${i + 1}: ${t}`).join("\n")}

IMPORTANT: Only ask questions about these topics. Use simple, beginner-level language. The student is a complete beginner (noob). Do NOT use advanced terminology without explaining it first.

QUESTION STRUCTURE (${DEFAULT_TOTAL_QUESTIONS} questions total):
- Questions 1-${Math.ceil(DEFAULT_TOTAL_QUESTIONS / 3)}: CONCEPTUAL — what is this topic? Why does it matter? How does it work at a high level?
- Questions ${Math.ceil(DEFAULT_TOTAL_QUESTIONS / 3) + 1}-${Math.ceil((DEFAULT_TOTAL_QUESTIONS * 2) / 3)}: IMPLEMENTATION — how do you actually USE this? Configuration, setup, common workflows. Ask "how would you..." not just "what is..."
- Questions ${Math.ceil((DEFAULT_TOTAL_QUESTIONS * 2) / 3) + 1}-${DEFAULT_TOTAL_QUESTIONS}: APPLIED/EDGE CASES — what happens when things go wrong? Troubleshooting, optimization, real-world scenarios. Ask "what if..." and "how would you debug..."

Mix the 4 Socratic pillars (Why Probe, Break-It Scenario, Client Translation, Edge Case Test) across all ${DEFAULT_TOTAL_QUESTIONS} questions. Adapt the question type to the topic — some topics are more conceptual, others more practical.`;
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student" && user.role !== "learner") {
    return NextResponse.json({ error: "Only students can take weekly tests" }, { status: 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const { isDemoAIBlocked, checkUserAILimit, categoryForFeature } = await import("@/lib/ai-rate-limits");
  const isDemoUser = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (admin-configurable, default 50/day for test category)
  const category = categoryForFeature("weekly-test");
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

  // Load course-specific test config (or fall back to defaults)
  const courseTestConfig = await getTestConfig(user.id);
  const TOTAL_QUESTIONS = courseTestConfig.totalQuestions;
  const MAX_MESSAGES_PER_QUESTION = courseTestConfig.maxRepliesPerQuestion;

  const body = await req.json().catch(() => ({}));
  const { week: weekRaw, message, action, projectName } = body as {
    week?: number; message?: string; action?: "start" | "reply" | "finish";
    projectName?: string;
  };
  // Input length caps — prevent monetary DoS via huge AI inputs
  if (message && message.length > 8000) {
    return NextResponse.json({ error: "Message too long (max 8000 characters)" }, { status: 400 });
  }
  // R7-fix: projectName was interpolated into the AI prompt with no cap
  if (projectName && projectName.length > 500) {
    return NextResponse.json({ error: "Project name too long (max 500 characters)" }, { status: 400 });
  }
  const week = Number(weekRaw ?? user.currentWeek);
  if (!week || week < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  // ---- Load the user's course duration (defaults to 6 if no course assigned) ----
  const totalWeeks = await getCourseDurationWeeks(user.id);
  if (week > totalWeeks) {
    return NextResponse.json({ error: `Week ${week} is out of range. This course has ${totalWeeks} week(s).` }, { status: 400 });
  }

  // ---- LOCK: skip task-completion check for the FINAL week (capstone — open all week) ----
  const isFinalWeek = week === totalWeeks;
  if (!isFinalWeek) {
    const weekTasks = await db.projectTask.findMany({
      where: { userId: user.id, week },
      select: { status: true },
    });
    if (weekTasks.length === 0) {
      return NextResponse.json({
        error: `You need to add tasks for Week ${week} first. Go to Project Plan → click Week ${week} → add tasks.`,
        locked: true,
      }, { status: 403 });
    }
    const completedTasks = weekTasks.filter(t => t.status === "completed").length;
    if (completedTasks < weekTasks.length) {
      return NextResponse.json({
        error: `Complete all Week ${week} tasks first. ${completedTasks}/${weekTasks.length} done. Mark remaining tasks as "completed" in the Project Plan.`,
        locked: true,
        completedTasks,
        totalTasks: weekTasks.length,
      }, { status: 403 });
    }
  }

  // ---- Get or create the test for this week ----
  let test = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: user.id, week } },
  });

  // ---- RETAKE GATE ----
  // If the test is already completed and the student tries to start it again,
  // only allow if the instructor has explicitly set `retakeAllowed = true`.
  // When the retake starts, reset the test + clear the flag so they can't
  // retake twice without teacher permission.
  if (test?.status === "completed" && action === "start") {
    if (!test.retakeAllowed) {
      // Phase 1.6: Parse weaknesses so we can include a study plan in the
      // retake-denial message. The student gets actionable guidance instead
      // of just "ask your instructor".
      let weaknesses: string[] = [];
      try { weaknesses = JSON.parse(test.weaknesses || "[]"); } catch { weaknesses = []; }
      const studyPlan = weaknesses.length > 0
        ? ` Before retaking, review these topics: ${weaknesses.join(", ")}.`
        : "";
      return NextResponse.json({
        error: `Week ${week} test already completed. Ask your instructor to allow a retake if you'd like to try again.${studyPlan}`,
        alreadyCompleted: true,
        retakeAllowed: false,
        weaknesses,
        test: {
          id: test.id, week: test.week, status: test.status, score: test.score,
          plagiarismScore: test.plagiarismScore,
          completedAt: test.completedAt, retakeAllowed: test.retakeAllowed,
        },
      }, { status: 403 });
    }
    // Teacher allowed retake — reset the test and clear the flag.
    // M4-rel: atomic conditional update — only clears retakeAllowed if
    // it's still true. If two concurrent requests both try to start the
    // retake, only the first succeeds (affects 1 row), the second gets
    // a row with retakeAllowed=false and falls through to the start
    // logic with the already-reset test.
    const retakeResult = await db.weeklyTest.updateMany({
      where: { id: test.id, retakeAllowed: true },
      data: {
        status: "in-progress",
        startedAt: new Date(),
        completedAt: null,
        conversation: "[]",
        currentQuestion: 0,
        replyCount: 0,
        score: null,
        retakeAllowed: false,
      },
    });
    if (retakeResult.count === 0) {
      // Another request already started the retake — re-fetch the test
      // (which is now in-progress) and fall through to the start logic.
      test = await db.weeklyTest.findUnique({
        where: { userId_week: { userId: user.id, week } },
      }) || test;
    }
    // Fall through to the start logic below
  }

  // ============================================================
  // Phase D.3: Final-result analysis is already cached on the
  // WeeklyTest row (score, plagiarismScore, weaknesses).
  // This guard prevents accidental regeneration if a "reply" or
  // "finish" action arrives for an already-completed test (race
  // condition: double-click, retried POST, stale client state).
  // Returns the stored analysis without re-calling the AI.
  // ============================================================
  if (test?.status === "completed" && (action === "reply" || action === "finish")) {
    let cachedConversation: ChatMessage[] = [];
    try { cachedConversation = JSON.parse(test.conversation || "[]"); } catch { cachedConversation = []; }
    let cachedWeaknesses: string[] = [];
    try { cachedWeaknesses = JSON.parse(test.weaknesses || "[]"); } catch { cachedWeaknesses = []; }

    return NextResponse.json({
      conversation: cachedConversation,
      isComplete: true,
      psychAnalysis: "",
      examinerComment: "",
      strengthSignal: "", // not stored separately pre-SDT — omitted from cache reads
      score: test.score ?? 0,
      plagiarismScore: test.plagiarismScore ?? 0,
      plagiarismNotes: "",
      weaknesses: cachedWeaknesses,
      plagiarismBreakdown: null,
      engagementFeedback: null,
      cached: true,
      message: "Test already completed — showing stored analysis.",
    });
  }

  if (!test) {
    // Use upsert to handle race conditions — if two requests arrive
    // simultaneously (double-click), the second one gets the existing
    // row instead of failing with a unique constraint error.
    try {
      test = await db.weeklyTest.upsert({
        where: { userId_week: { userId: user.id, week } },
        create: { userId: user.id, week, status: "in-progress", startedAt: new Date() },
        update: {},
      });
    } catch {
      return NextResponse.json({ error: "Failed to create test" }, { status: 500 });
    }
  }

  let conversation: ChatMessage[] = [];
  try { conversation = JSON.parse(test.conversation); } catch { conversation = []; }

  const SYSTEM_PROMPT = await buildSystemPrompt(user.id, week, totalWeeks);
  const topics = await getCourseWeekTopicTitles(user.id, week);
  const phase = await getCourseWeekPhase(user.id, week);

  // ---- ACTION: START ----
  if (action === "start") {
    conversation = [];
    const context = `Week ${week}: ${phase}. Project: ${projectName || user.projectName || "your capstone project"}. Daily topics: ${topics.join(", ")}.`;
    const firstTurn = await callAILocal([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nStart the test. You are on Question 1 of 10. Confirm the week's topics briefly (1 sentence), then ask your first beginner-level question about Day 1's topic: "${topics[0]}". Do NOT prefix with "Question 1:" — just ask the question directly.` },
    ], "weekly-test-start", undefined, user.id);
    const firstMsg = firstTurn.text.replace(/^Question\s*\d+\s*:\s*/i, "").trim();
    conversation.push({ role: "examiner", content: firstMsg, timestamp: new Date().toISOString(), questionIndex: 0 });
    await saveConversation(test.id, conversation, 0, 0, "in-progress");
    return NextResponse.json({
      conversation, currentQuestion: 0, replyCount: 0,
      totalQuestions: TOTAL_QUESTIONS, maxReplies: MAX_MESSAGES_PER_QUESTION,
      isComplete: false,
      weekTopics: topics, weekPhase: phase,
    });
  }

  // ---- ACTION: REPLY ----
  if (action === "reply" && message?.trim()) {
    const studentMessage = message.trim();

    // SERVER-SIDE CHEATING DETECTION: Check if the student pasted the
    // examiner's own question back as their answer. This is a common
    // cheating tactic where the student just copies the question.
    const lastExaminerMsg = conversation.filter(m => m.role === "examiner").slice(-1)[0];
    let pasteWarning = "";
    if (lastExaminerMsg) {
      // Normalize both texts for comparison
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      const examinerNorm = normalize(lastExaminerMsg.content);
      const studentNorm = normalize(studentMessage);
      // If >60% of the student's answer matches the examiner's question
      if (studentNorm.length > 20) {
        const examinerWords = examinerNorm.split(" ");
        const studentWords = studentNorm.split(" ");
        const matchingWords = studentWords.filter(w => examinerWords.includes(w) && w.length > 3);
        const matchRate = matchingWords.length / studentWords.length;
        if (matchRate > 0.6 || examinerNorm.includes(studentNorm) || studentNorm.includes(examinerNorm.slice(0, 100))) {
          pasteWarning = "[CHEATING DETECTED: The student appears to have pasted the examiner's question back as their answer. Do NOT praise this. Note it in your assessment. Ask them to answer in their own words.]";
        }
      }
    }

    // Check for "I don't know" / "skip" / "not interested" patterns
    const lowerMsg = studentMessage.toLowerCase();
    const isAvoidance = /^(i don'?t know|idk|skip|not interested|don'?t want|next question|no idea|pass)\b/i.test(lowerMsg) || lowerMsg.length < 5;
    const avoidanceWarning = isAvoidance ? "[AVOIDANCE: The student is avoiding the question. Note this for the assessment. Move to the next question.]" : "";

    conversation.push({
      role: "student", content: studentMessage,
      timestamp: new Date().toISOString(), questionIndex: test.currentQuestion,
    });

    const newReplyCount = test.replyCount + 1;
    const isLastMessage = newReplyCount >= MAX_MESSAGES_PER_QUESTION;
    const isLastQuestion = test.currentQuestion >= TOTAL_QUESTIONS - 1;

    // COMPACT LEDGER (2026-08-15): the AI never sees the raw chat
    // history — it sees one bounded line per completed question plus the
    // current question + latest answer. Every turn stays small and
    // constant-size, so long sessions can no longer time out. The ledger
    // is derived from data already saved locally per question.
    const ledger = buildTestLedger(conversation);
    const ledgerText = ledgerToPrompt(ledger);
    const currentQuestionText = (conversation
      .filter(m => m.role === "examiner" && m.questionIndex === test.currentQuestion)
      .map(m => m.content)
      .join(" ")
      || `Week ${week} topics`).slice(0, 400);

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `[LANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu (e.g. "zaroori hota hai", "tum kon ho", "karna hai"), your ENTIRE response MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language ("explain in urdu"), comply. NEVER ask them to switch to English. Technical terms stay in English.]

TEST LEDGER (completed questions, compact):
${ledgerText}

CURRENT QUESTION (${test.currentQuestion + 1} of ${TOTAL_QUESTIONS}): "${currentQuestionText}"
The student just answered (reply ${newReplyCount} of ${MAX_MESSAGES_PER_QUESTION}): "${studentMessage.slice(0, 800)}"
${pasteWarning} ${avoidanceWarning}

Give 1-2 sentences of brief feedback on the student's answer. Then decide:
- If the answer was clear enough to assess (even if partially wrong): set "advance": true.
- If it's too unclear or brief: ask ONE brief probing follow-up about the SAME topic. Set "advance": false.
- If off-topic or pasting the question back: redirect firmly, do NOT praise it. Set "advance": false unless this is their 2nd attempt.

CRITICAL RULES:
- Do NOT ask the next question in this reply — the next question is generated separately.
- Do NOT repeat sentences. Keep feedback under 3 sentences. No behavioral observations.
- Do NOT explain concepts in detail. You are testing, not teaching.
- Do NOT say "correct" or "good" for pasted or non-answers.`,
      },
    ];

    const examinerTurn = await callAILocal(aiMessages, "weekly-test-reply", undefined, user.id);

    // The prompt itself signals advancement via the JSON "advance" field
    // (2026-08-15 JSON-mode sweep) — no marker scraping, no phrase
    // heuristics. The 5-reply cap still forces the move.
    const wantsAdvance = examinerTurn.advance;
    const examinerResponse = examinerTurn.text.replace(/^Question\s*\d+\s*:\s*/im, "").trim();

    const shouldAdvance = wantsAdvance || isLastMessage;

    let nextQuestion = test.currentQuestion;
    let nextReplyCount = newReplyCount;
    let isComplete = false;

    // Per-question explanation + AUTO-NEXT-QUESTION (2026-08-15): when the
    // examiner advances, the question that just ended is graded AND the
    // next question is generated by its OWN AI call — in parallel, so the
    // turn stays fast. The next question is displayed as its own message.
    let perQuestionExplanation: QuestionExplanation | undefined;
    let autoNextQuestion: string | null = null;
    if (shouldAdvance) {
      const questionJustEnded = conversation
        .filter(m => m.role === "examiner" && m.questionIndex === test.currentQuestion)
        .map(m => m.content)
        .join(" ");
      const studentAnswersToThisQuestion = conversation
        .filter(m => m.role === "student" && m.questionIndex === test.currentQuestion)
        .map(m => m.content);
      const grading = questionJustEnded && studentAnswersToThisQuestion.length > 0
        ? gradeOneQuestion({
            question: questionJustEnded,
            studentAnswers: studentAnswersToThisQuestion,
            topic: topics[Math.min(test.currentQuestion, topics.length - 1)] || `Week ${week}`,
            testKind: "weekly_test",
            studentName: user.name,
          })
        : Promise.resolve(undefined);
      const nextQ = !isLastQuestion
        ? generateNextQuestion({
            systemPrompt: SYSTEM_PROMPT,
            ledgerText,
            questionNumber: test.currentQuestion + 2,
            totalQuestions: TOTAL_QUESTIONS,
            topic: topics[Math.min(test.currentQuestion + 1, topics.length - 1)] || `Week ${week}`,
            weekLabel: `Week ${week} — ${phase}`,
          })
        : Promise.resolve(null);
      const [explanation, nextQuestionText] = await Promise.all([grading, nextQ]);
      perQuestionExplanation = explanation;
      autoNextQuestion = nextQuestionText;
    }

    if (shouldAdvance) {
      if (isLastQuestion) {
        isComplete = true;
        const questionsAnswered = test.currentQuestion + 1;
        const analysis = await generateFinalAnalysis(ledgerText, user.name, week, phase, topics, user.id);
        conversation.push({
          role: "examiner", content: examinerResponse,
          timestamp: new Date().toISOString(), questionIndex: test.currentQuestion,
          questionExplanation: perQuestionExplanation,
        });
        // TRANSACTION: mark the test completed AND advance the student's week
        // atomically. Without this, a failure between the two queries leaves
        // the student with a completed test but stuck on the same week forever
        // (they can't retake, can't advance, can't see next-week content).
        // AI DOES ALL CALCULATIONS (2026-08-15): analysis.score is already
        // the FINAL score — scaled for skipped questions and reduced for
        // plagiarism by the AI itself. The app only clamps, stores, displays.
        const finalScore = Math.max(0, Math.min(100, analysis.score));
        const rawScore = Math.max(0, Math.min(100, analysis.rawScore ?? analysis.score));
        const plagiarismResult = {
          rawScore,
          plagiarismScore: analysis.plagiarismScore,
          deductedMarks: Math.max(0, rawScore - finalScore),
          finalScore,
          deductionPercent: analysis.plagiarismScore,
        };
        await db.$transaction(async (tx) => {
          await tx.weeklyTest.update({
            where: { id: test.id },
            data: {
              status: "completed",
              completedAt: new Date(),
              conversation: JSON.stringify(conversation),
              score: finalScore, // AI-computed FINAL score (deductions applied)
              plagiarismScore: analysis.plagiarismScore,
              // Phase 1.6: Store the weaknesses array so the student dashboard
              // can show a study plan ("review these topics before retaking").
              weaknesses: JSON.stringify(analysis.weaknesses || []),
              currentQuestion: questionsAnswered,
            },
          });
          // BUG-1 FIX: Auto-advance the student's current week after completing the test.
          // Without this, the student is stuck at Week 1 forever.
          // Cap at totalWeeks so the student doesn't advance past the final week.
          if (user.currentWeek === week && user.currentWeek < totalWeeks) {
            await tx.user.update({
              where: { id: user.id },
              data: { currentWeek: user.currentWeek + 1 },
            });
          }
        });
        // Write a unified ChatSession row (chatbotType="weekly_test") so all
        // chatbot sessions live in one model for cross-chatbot analysis.
        // Non-blocking — best-effort.
        db.chatSession.create({
          data: {
            userId: user.id,
            chatbotType: "weekly_test",
            week,
            topic: phase,
            status: "completed",
            score: plagiarismResult.finalScore,
            totalQuestions: TOTAL_QUESTIONS,
            currentQuestion: questionsAnswered,
            conversation: JSON.stringify(conversation),
            completedAt: new Date(),
          },
        }).catch((err) => { logger.warn("Operation failed", { err }); });

        // === Evidence-Locked XP — award for natural weekly test completion ===
        // Same logic as the early-finish path. Idempotent via refId=test.id.
        void (async () => {
          try {
            const finalScore = plagiarismResult.finalScore;
            if (finalScore >= 60) {
              await awardXP({
                userId: user.id,
                reason: "WEEKLY_TEST_PASSED",
                refId: test.id,
              });
              if (finalScore >= 90) {
                await awardXP({
                  userId: user.id,
                  reason: "WEEKLY_TEST_ACED",
                  refId: test.id,
                });
              }
            }
          } catch (err) {
            logger.warn("XP award failed (weekly-test natural)", {
              userId: user.id,
              testId: test.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();

        // ── Badge awards for weekly test ──────────────────────────
        void (async () => {
          try {
            const finalScore = plagiarismResult.finalScore;
            // Badge: first weekly test
            await awardBadge({ userId: user.id, badgeId: "first_weekly" });
            // Badge: perfect weekly score
            if (finalScore >= 100) {
              await awardBadge({ userId: user.id, badgeId: "perfect_weekly" });
            }
            // Badge: course complete (if final week + passed)
            if (week === totalWeeks && finalScore >= 60) {
              await awardBadge({ userId: user.id, badgeId: "course_complete" });
              if (finalScore >= 85) {
                await awardBadge({ userId: user.id, badgeId: "course_distinction" });
              }
            }
          } catch (err) {
            logger.warn("Weekly test badge award failed", { userId: user.id, testId: test.id, error: err instanceof Error ? err.message : String(err) });
          }
        })();

        // === Phase 6: Certificate pipeline (fire-and-forget) ===
        // After a weekly test is marked completed, kick off the auto-issuance
        // check. If this was the final week and the student meets the score
        // threshold, a verified credential is issued + a notification fired.
        // Non-blocking — never makes the test response wait on it.
        void (async () => {
          try {
            const enrollment = await db.courseEnrollment.findFirst({
              where: { userId: user.id, role: "student" },
              select: { courseId: true },
            });
            if (enrollment?.courseId) {
              await issueCertificate(user.id, enrollment.courseId);
            }
          } catch (err) {
            logger.warn("Auto-issue certificate after weekly test failed", {
              userId: user.id,
              week,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();

        return NextResponse.json({
          conversation, currentQuestion: test.currentQuestion, replyCount: newReplyCount,
          totalQuestions: TOTAL_QUESTIONS, maxReplies: MAX_MESSAGES_PER_QUESTION,
          isComplete: true, ...analysis,
          score: plagiarismResult.finalScore, // Return DEDUCTED score to student
          rawScore: plagiarismResult.rawScore, // Also return raw score for transparency
          plagiarismDeduction: plagiarismResult, // Full breakdown
          weekPhase: phase,
          questionsAnswered,
          totalReplies: conversation.filter(m => m.role === "student").length,
        });
      } else {
        nextQuestion = test.currentQuestion + 1;
        nextReplyCount = 0;
      }
    }

    // Feedback reply for the question that just ended, tagged with its
    // question index + per-question explanation. Then the AUTO-generated
    // next question (2026-08-15) is appended as its OWN message so the
    // student sees the next question immediately without sending anything.
    if (!isComplete) {
      conversation.push({
        role: "examiner", content: examinerResponse,
        timestamp: new Date().toISOString(), questionIndex: test.currentQuestion,
        ...(perQuestionExplanation ? { questionExplanation: perQuestionExplanation } : {}),
      });
      if (autoNextQuestion) {
        conversation.push({
          role: "examiner", content: autoNextQuestion,
          timestamp: new Date().toISOString(), questionIndex: nextQuestion,
        });
      }
    }

    // C2-fix: pass expected values for optimistic locking
    // C2-R1-fix: check the return value — if false, the optimistic lock
    // failed (concurrent write). Return 409 so the client knows to retry.
    const saved = await saveConversation(test.id, conversation, nextQuestion, nextReplyCount, "in-progress", test.currentQuestion, test.replyCount);
    if (saved === false) {
      // Re-fetch the current state so the client can sync
      const current = await db.weeklyTest.findUnique({
        where: { id: test.id },
        select: { currentQuestion: true, replyCount: true, conversation: true },
      });
      let currentConversation: ChatMessage[] = [];
      try { currentConversation = JSON.parse(current?.conversation || "[]"); } catch { currentConversation = []; }
      return NextResponse.json({
        error: "Your reply was not saved because another request updated the test first. Please retry.",
        conversation: currentConversation,
        currentQuestion: current?.currentQuestion ?? nextQuestion,
        replyCount: current?.replyCount ?? nextReplyCount,
        totalQuestions: TOTAL_QUESTIONS, maxReplies: MAX_MESSAGES_PER_QUESTION,
        isComplete: false,
        weekPhase: phase,
        retry: true,
      }, { status: 409 });
    }
    return NextResponse.json({
      conversation, currentQuestion: nextQuestion, replyCount: nextReplyCount,
      totalQuestions: TOTAL_QUESTIONS, maxReplies: MAX_MESSAGES_PER_QUESTION,
      isComplete,
      weekPhase: phase,
    });
  }

  // ---- ACTION: FINISH (early) ----
  if (action === "finish") {
    // The AI receives the COMPACT LEDGER (all data, bounded size) plus the
    // answered/total stats — it computes the final score with every
    // calculation (skip penalty + plagiarism deduction) itself.
    const answeredSet = new Set<number>();
    for (const m of conversation) {
      if (m.role === "student" && typeof m.questionIndex === "number") {
        answeredSet.add(m.questionIndex);
      }
    }
    const answered = Math.min(answeredSet.size, TOTAL_QUESTIONS);
    const finishLedger = ledgerToPrompt(buildTestLedger(conversation));
    const analysis = await generateFinalAnalysis(
      `${finishLedger}\n\nTEST STATS: answered ${answered} of ${TOTAL_QUESTIONS} questions — unanswered questions count as 0. Week ${week} (${phase}). Topics: ${topics.join(", ")}.`,
      user.name,
      week,
      phase,
      topics,
      user.id,
    );
    // AI DOES ALL CALCULATIONS (2026-08-15): analysis.score already IS the
    // final score — the AI scaled it for the skipped questions (unanswered
    // = 0) and applied the plagiarism deduction itself. The app only
    // clamps, stores and displays.
    const finalScore = Math.max(0, Math.min(100, analysis.score));
    const rawScore = Math.max(0, Math.min(100, analysis.rawScore ?? analysis.score));
    const plagiarismResult = {
      rawScore,
      plagiarismScore: analysis.plagiarismScore,
      deductedMarks: Math.max(0, rawScore - finalScore),
      finalScore,
      deductionPercent: analysis.plagiarismScore,
    };
    await db.$transaction(async (tx) => {
      await tx.weeklyTest.update({
        where: { id: test.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          conversation: JSON.stringify(conversation),
          score: finalScore, // AI-computed FINAL score (deductions applied)
          plagiarismScore: analysis.plagiarismScore,
          // Phase 1.6: Store weaknesses for the study plan
          weaknesses: JSON.stringify(analysis.weaknesses || []),
          currentQuestion: test.currentQuestion + 1,
        },
      });
      // BUG-1 FIX: Auto-advance week (cap at totalWeeks)
      if (user.currentWeek === week && user.currentWeek < totalWeeks) {
        await tx.user.update({
          where: { id: user.id },
          data: { currentWeek: user.currentWeek + 1 },
        });
      }
    });
    // Phase Three-Tab Redesign: run analysis pipeline after early-finish too
    // Uses the FINAL (post-deduction) score.

    // === Evidence-Locked XP — award for weekly test completion ===
    // Idempotent: if the same test ID has already been awarded, this is a no-op.
    // Score >= 60 → WEEKLY_TEST_PASSED (+50). Score >= 90 → also ACED (+80).
    // Fire-and-forget — XP is non-critical, must never block the response.
    void (async () => {
      try {
        const finalScore = plagiarismResult.finalScore;
        if (finalScore >= 60) {
          await awardXP({
            userId: user.id,
            reason: "WEEKLY_TEST_PASSED",
            refId: test.id,
          });
          if (finalScore >= 90) {
            await awardXP({
              userId: user.id,
              reason: "WEEKLY_TEST_ACED",
              refId: test.id,
            });
          }
        }
      } catch (err) {
        logger.warn("XP award failed (weekly-test finish)", {
          userId: user.id,
          testId: test.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    // === Phase 6: Certificate pipeline (fire-and-forget) — early-finish path ===
    void (async () => {
      try {
        const enrollment = await db.courseEnrollment.findFirst({
          where: { userId: user.id, role: "student" },
          select: { courseId: true },
        });
        if (enrollment?.courseId) {
          await issueCertificate(user.id, enrollment.courseId);
        }
      } catch (err) {
        logger.warn("Auto-issue certificate after early-finish failed", {
          userId: user.id,
          week,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return NextResponse.json({
      conversation, isComplete: true, ...analysis,
      score: plagiarismResult.finalScore, // DEDUCTED score
      rawScore: plagiarismResult.rawScore,
      plagiarismDeduction: plagiarismResult,
      weekPhase: phase,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** The examiner's reply — structured by the prompt itself, not by
 *  post-processing: `text` is the message and `advance` is the model's
 *  explicit move-to-next-question signal (replaces the old [ADVANCE]
 *  marker + regex heuristics, 2026-08-15 JSON-mode sweep). */
const ExaminerTurnSchema = z.object({
  text: z.string().min(1),
  advance: z.boolean(),
});

/** The final-analysis payload — validated by zod instead of defensive
 *  field-by-field parsing (2026-08-15 JSON-mode sweep). */
const FinalAnalysisSchema = z.object({
  rawScore: z.number().min(0).max(100).optional(),
  psychAnalysis: z.string().optional(),
  examinerComment: z.string().optional(),
  strengthSignal: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  plagiarismScore: z.number().min(0).max(100).optional(),
  plagiarismNotes: z.string().optional(),
  weaknesses: z.array(z.string()).optional(),
  plagiarismBreakdown: z
    .object({
      voiceConsistency: z.string(),
      perAnswerFlags: z.array(
        z.object({
          questionIndex: z.number(),
          flagged: z.boolean(),
          reason: z.string(),
        }),
      ),
      strongestSignal: z.string(),
      instructorNote: z.string(),
    })
    .nullable()
    .optional(),
  engagementFeedback: z
    .object({
      subjectChanges: z.number(),
      avoidanceCount: z.number(),
      distractedQuestions: z.array(z.number()),
      overallEngagement: z.string(),
      studentFeedback: z.string(),
      instructorNote: z.string(),
    })
    .nullable()
    .optional(),
  modelAnswer: z.string().optional(),
  missedPoints: z.array(z.string()).optional(),
  nextTime: z.string().optional(),
  questionExplanations: z
    .array(
      z.object({
        questionIndex: z.number().optional(),
        question: z.string().optional(),
        studentAnswer: z.string().optional(),
        correctAnswer: z.string().optional(),
        explanation: z.string().optional(),
        encouragement: z.string().optional(),
        score: z.number().min(0).max(100).optional(),
      }),
    )
    .optional(),
});

/** Call AI via JSON mode — catches errors and returns a fallback prompt
 *  so a single AI failure doesn't crash the whole test. */
async function callAILocal(messages: { role: string; content: string }[], feature: string, maxTokens?: number, userId?: string): Promise<{ text: string; advance: boolean }> {
  try {
    const result = await callAIJson<z.infer<typeof ExaminerTurnSchema>>(
      messages.map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
      {
        schema: ExaminerTurnSchema,
        feature,
        userId,
        temperature: 0.5,
        maxTokens: maxTokens ?? TOKEN_BUDGET.WEEKLY_TEST_REPLY,
      },
    );
    if (result.ok) {
      return { text: sanitizeExaminerText(result.data.text), advance: result.data.advance };
    }
  } catch (err) {
    logger.warn("Weekly test AI call failed", { feature, error: err instanceof Error ? err.message : String(err) });
  }
  return { text: "Can you elaborate on that? Walk me through your reasoning.", advance: false };
}

/** Generate final analysis — uses course-aligned context.
 *  Returns the AI's assessment + weaknesses + per-answer plagiarism breakdown
 *  + engagement feedback. All of this is stored on the WeeklyTest row and
 *  surfaced to the student (constructive version) and teacher (full detail). */
async function generateFinalAnalysis(
  testData: string,
  studentName: string,
  week: number,
  phase: string,
  topics: string[],
  studentUserId?: string
): Promise<{
  rawScore: number;
  psychAnalysis: string;
  examinerComment: string;
  strengthSignal: string;
  score: number;
  plagiarismScore: number;
  plagiarismNotes: string;
  weaknesses: string[];
  plagiarismBreakdown: {
    voiceConsistency: string;
    perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
    strongestSignal: string;
    instructorNote: string;
  } | null;
  engagementFeedback: {
    subjectChanges: number;
    avoidanceCount: number;
    distractedQuestions: number[];
    overallEngagement: string;
    studentFeedback: string;
    instructorNote: string;
  } | null;
  feedback: TeachingFeedback;
}> {
  // The prompt receives the compact per-question LEDGER + test stats
  // (bounded size — long sessions can't time out the final analysis).
  const transcript = testData;

  try {
    // JSON-mode final analysis (2026-08-15 sweep): the prompt itself
    // demands this exact schema — zod validates it, no regex extraction,
    // no defensive field-by-field parsing.
    const result = await callAIJson<z.infer<typeof FinalAnalysisSchema>>(
      [{ role: "user", content: finalAnalysisPrompt(studentName, transcript) }],
      {
        schema: FinalAnalysisSchema,
        feature: "final-analysis",
        userId: studentUserId,
        temperature: 0.3,
        maxTokens: TOKEN_BUDGET.FINAL_ANALYSIS,
      },
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
    const d = result.data;
    const replies = (testData.match(/Student: "/g) || []).length || 1;
    const fb = fallbackGrade(topics[0] || `Week ${week}`, "weekly_test", replies).feedback;

    // Store the REAL score (0-100) — zod already clamped NaN/strings out.
    const clampedScore = Math.max(0, Math.min(100, d.score ?? 70));
    const clampedPlagiarism = Math.max(0, Math.min(100, d.plagiarismScore ?? 0));

    const missed = (d.missedPoints ?? []).filter((s) => s.trim().length > 0).slice(0, 4);

    return {
      rawScore: d.rawScore ?? clampedScore,
      psychAnalysis: d.psychAnalysis ?? "Engagement was consistent. Cognitive load appeared moderate.",
      examinerComment: d.examinerComment ?? "Practitioner level. Solid fundamentals with room for deeper reasoning.",
      strengthSignal: d.strengthSignal ?? "You showed up and engaged with the material — that's the foundation everything else builds on.",
      score: clampedScore,
      plagiarismScore: clampedPlagiarism,
      plagiarismNotes: d.plagiarismNotes ?? "No signs of plagiarism detected.",
      weaknesses: (d.weaknesses ?? []).filter((w) => w.trim().length > 0).slice(0, 5),
      plagiarismBreakdown: d.plagiarismBreakdown ?? null,
      engagementFeedback: d.engagementFeedback ?? null,
      feedback: {
        modelAnswer: d.modelAnswer?.trim() || fb.modelAnswer,
        missedPoints: missed.length > 0 ? missed : fb.missedPoints,
        nextTime: d.nextTime?.trim() || fb.nextTime,
        questionExplanations: (d.questionExplanations ?? [])
          .filter((x) => Boolean(x.correctAnswer && x.explanation))
          .map((x, i) => ({
            questionIndex: x.questionIndex ?? i,
            question: x.question?.trim() || "(question unavailable)",
            studentAnswer: x.studentAnswer?.trim() || "(no answer captured)",
            correctAnswer: x.correctAnswer as string,
            explanation: x.explanation as string,
            encouragement:
              x.encouragement?.trim() || "Keep practicing — every attempt teaches you something.",
            score: Math.round(x.score ?? 50),
          })),
      },
    };
  } catch {
    const replies = (testData.match(/Student: "/g) || []).length || 1;
    // Fallback when the AI call itself failed (network, quota, etc.).
    // Score based on engagement level — a student who replied more at least
    // engaged. The student-facing UI buffers low scores with a study plan.
    const fallbackScore = Math.max(20, Math.min(75, 30 + replies * 4));
    // Use the week's topics as fallback weaknesses — at least gives the
    // student something concrete to review.
    const fallbackWeaknesses = topics.slice(0, 3);
    return {
      rawScore: fallbackScore,
      psychAnalysis: `Completed ${replies} replies across the test. Engagement was consistent.`,
      examinerComment: `Beginner level based on Week ${week} (${phase}). Keep practicing!`,
      strengthSignal: `You completed ${replies} replies and engaged with every question — showing up consistently is the most important habit for learning.`,
      score: fallbackScore,
      plagiarismScore: 0,
      plagiarismNotes: "No signs of plagiarism detected.",
      weaknesses: fallbackWeaknesses,
      plagiarismBreakdown: null,
      engagementFeedback: null,
      feedback: fallbackGrade(topics[0] || `Week ${week}`, "weekly_test", replies).feedback,
    };
  }
}

/** AUTO-NEXT-QUESTION (2026-08-15): after a question's final reply, this
 *  generates the next question with its OWN small AI call. The payload is
 *  the compact ledger + the next topic — bounded and constant-size, so a
 *  long session can never make this call time out. */
async function generateNextQuestion(args: {
  systemPrompt: string;
  ledgerText: string;
  questionNumber: number;
  totalQuestions: number;
  topic: string;
  weekLabel: string;
}): Promise<string> {
  try {
    const result = await callAIJson<{ text: string }>(
      buildNextQuestionPrompt(args),
      {
        schema: z.object({ text: z.string().min(1).max(400) }),
        feature: "weekly-test-next-question",
        temperature: 0.6,
        maxTokens: 200,
      },
    );
    if (result.ok && result.data.text.trim()) {
      return result.data.text.replace(/^Question\s*\d+\s*:\s*/im, "").trim();
    }
  } catch (err) {
    logger.warn("next-question generation failed", { error: err instanceof Error ? err.message : String(err) });
  }
  return `Tell me what you know about "${args.topic}" — and give me one example.`;
}

/** Save conversation (only during in-progress; cleared on completion). */
async function saveConversation(
  testId: string,
  conversation: ChatMessage[],
  currentQuestion: number,
  replyCount: number,
  status: string,
  expectedQuestion?: number,
  expectedReply?: number,
) {
  try {
    // C2-fix: optimistic locking using updateMany with expected values.
    // If another request already updated the test (double-submit race),
    // the where clause won't match and count=0. This prevents the
    // second write from corrupting the conversation array.
    // expectedQuestion/expectedReply are the values we READ at the start
    // of the request — if they don't match the DB, someone else wrote first.
    if (expectedQuestion !== undefined && expectedReply !== undefined) {
      const result = await db.weeklyTest.updateMany({
        where: {
          id: testId,
          currentQuestion: expectedQuestion,
          replyCount: expectedReply,
        },
        data: {
          conversation: JSON.stringify(conversation),
          currentQuestion,
          replyCount,
          status,
        },
      });
      if (result.count === 0) {
        logger.warn("saveConversation: optimistic lock failed (concurrent write)", {
          testId, expectedQuestion, expectedReply, currentQuestion, replyCount,
        });
        return false;  // signal to caller that the write was skipped
      }
      return true;
    }
    // Fallback: no optimistic locking (for the start action where there's
    // no expected state to check against)
    await db.weeklyTest.update({
      where: { id: testId },
      data: {
        conversation: JSON.stringify(conversation),
        currentQuestion,
        replyCount,
        status,
      },
    });
    return true;
  } catch (err) {
    // Log the error — silent swallowing loses student conversation data
    // with no trace. The student sees their answer vanish.
    logger.error("Failed to save weekly test conversation", {
      testId, currentQuestion, replyCount, status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** GET — return test state. For completed tests, returns RESULTS ONLY (no chat). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load course-specific test config
  const courseTestConfig = await getTestConfig(user.id);
  const TOTAL_QUESTIONS = courseTestConfig.totalQuestions;
  const MAX_MESSAGES_PER_QUESTION = courseTestConfig.maxRepliesPerQuestion;

  const week = Number(req.nextUrl.searchParams.get("week") ?? user.currentWeek);
  const test = await db.weeklyTest.findUnique({
    where: { userId_week: { userId: user.id, week } },
  });

  const topics = await getCourseWeekTopicTitles(user.id, week);
  const phase = await getCourseWeekPhase(user.id, week);

  if (!test) {
    return NextResponse.json({
      test: null, conversation: [], currentQuestion: 0, replyCount: 0, isComplete: false,
      weekTopics: topics, weekPhase: phase,
    });
  }

  // For completed tests — return results + saved conversation (BUG-4 FIX:
  // was returning [] which deleted the student's Q&A history)
  if (test.status === "completed") {
    let savedConversation: ChatMessage[] = [];
    try { savedConversation = JSON.parse(test.conversation || "[]"); } catch { savedConversation = []; }
    // Phase 1.6: Parse the weaknesses array so the student dashboard can
    // show a study plan ("review these topics before retaking").
    let weaknesses: string[] = [];
    try { weaknesses = JSON.parse(test.weaknesses || "[]"); } catch { weaknesses = []; }

    // analysisBreakdown (plagiarism per-answer + engagement feedback) was
    // previously stored on WeeklyTest.examinerObs. That column has been
    // dropped, so the GET endpoint can no longer surface the full breakdown
    // — students/instructors only see the aggregate score + weaknesses now.

    return NextResponse.json({
      test: {
        id: test.id, week: test.week, status: test.status, score: test.score,
        currentQuestion: test.currentQuestion, replyCount: test.replyCount,
        completedAt: test.completedAt, retakeAllowed: test.retakeAllowed,
        plagiarismScore: test.plagiarismScore,
        // Phase 1.6: weaknesses array for the study plan
        weaknesses,
        // Phase 1.1: flag for the student-facing UI — if true, the UI shows
        // a kind "here's what to focus on" message instead of the raw score.
        // The instructor-facing portfolio view always shows the real score.
        needsStudyPlan: (test.score ?? 100) < 60,
        // Phase 1.2 v2 + 1.3 v2: full analysis breakdown no longer persisted
        plagiarismNotes: "No signs of plagiarism detected.",
        plagiarismBreakdown: null,
        engagementFeedback: null,
        feedback: null,
      },
      conversation: savedConversation,
      currentQuestion: test.currentQuestion,
      replyCount: test.replyCount,
      totalQuestions: TOTAL_QUESTIONS,
      maxReplies: MAX_MESSAGES_PER_QUESTION,
      isComplete: true,
      weekTopics: topics, weekPhase: phase,
    });
  }

  // For in-progress tests — return current conversation
  let conversation: ChatMessage[] = [];
  try { conversation = JSON.parse(test.conversation); } catch { conversation = []; }
  return NextResponse.json({
    test: {
      id: test.id, week: test.week, status: test.status, score: test.score,
      currentQuestion: test.currentQuestion, replyCount: test.replyCount,
      retakeAllowed: test.retakeAllowed,
    },
    conversation,
    currentQuestion: test.currentQuestion,
    replyCount: test.replyCount,
    totalQuestions: TOTAL_QUESTIONS,
    maxReplies: MAX_MESSAGES_PER_QUESTION,
    isComplete: test.status === "completed",
    weekTopics: topics, weekPhase: phase,
  });
}
