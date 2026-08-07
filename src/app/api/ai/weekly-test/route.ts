import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { weeklyTestSystemPrompt, finalAnalysisPrompt } from "@/lib/ai-prompts";
import { getCourseWeekTopicTitles, getCourseWeekPhase, getCourseDurationWeeks, getCourseMetadata } from "@/lib/course-db";
import { getTestConfig, getAIPrompts } from "@/lib/course-config";
import { logger } from "@/lib/logger";
import { applyPlagiarismDeduction } from "@/lib/plagiarism-scoring";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { fallbackGrade, parseQuestionExplanations, type TeachingFeedback, type QuestionExplanation } from "@/lib/unified-grader";
import { gradeOneQuestion } from "@/modules/assessment/lib/unified-test-engine";
import { demoWriteBlock } from "@/lib/demo-guard";
import { issueCertificate } from "@/lib/certificate";

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

// Default constants — overridden by course-specific test config
// Phase Psychological: increased to 15 questions to include both conceptual
// AND implementation questions. The weekly test now covers:
// Q1-5: Conceptual (what is it, why it matters) — uses Socratic pillars
// Q6-10: Implementation (how to use it, configure, deploy) — practical
// Q11-15: Applied/Edge cases (what breaks, troubleshooting, optimization)
const DEFAULT_MAX_MESSAGES = 5;
const DEFAULT_TOTAL_QUESTIONS = 15;

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

QUESTION STRUCTURE (15 questions total):
- Questions 1-5: CONCEPTUAL — what is this topic? Why does it matter? How does it work at a high level?
- Questions 6-10: IMPLEMENTATION — how do you actually USE this? Configuration, setup, common workflows. Ask "how would you..." not just "what is..."
- Questions 11-15: APPLIED/EDGE CASES — what happens when things go wrong? Troubleshooting, optimization, real-world scenarios. Ask "what if..." and "how would you debug..."

Mix the 4 Socratic pillars (Why Probe, Break-It Scenario, Client Translation, Edge Case Test) across all 15 questions. Adapt the question type to the topic — some topics are more conceptual, others more practical.`;
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
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
    const firstMsgRaw = await callAILocal([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nStart the test. You are on Question 1 of 10. Confirm the week's topics briefly (1 sentence), then ask your first beginner-level question about Day 1's topic: "${topics[0]}". Do NOT prefix with "Question 1:" — just ask the question directly.` },
    ], "weekly-test-start", undefined, user.id);
    // Strip any "Question N:" prefix the AI might add
    const firstMsg = firstMsgRaw.replace(/^Question\s*\d+\s*:\s*/i, "").trim();
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

    // Send MORE context to the AI — last 8 messages (was 4) so the AI
    // can see the original question + follow-ups + behavioral patterns.
    // This gives the AI enough context to probe effectively and detect
    // inconsistency patterns for plagiarism detection.
    const recentMessages = conversation.slice(-8);
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentMessages.map(m => ({
        role: m.role === "examiner" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    // For non-final replies, instruct the AI to probe or advance
    if (!isLastMessage) {
      aiMessages.push({
        role: "user",
        content: `[LANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu (e.g. "zaroori hota hai", "tum kon ho", "karna hai"), your ENTIRE response MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language ("explain in urdu"), comply. NEVER ask them to switch to English. Technical terms stay in English.]

You are on Question ${test.currentQuestion + 1} of 10. Reply ${newReplyCount} of ${MAX_MESSAGES_PER_QUESTION}. ${pasteWarning} ${avoidanceWarning}

Give 1-2 sentences of brief feedback on the student's answer. Then decide:

If the student's answer was clear enough to assess (even if partially wrong): ask the NEXT question (Question ${test.currentQuestion + 2} of 10) about ${isLastQuestion ? "wrap up the test" : `Day ${test.currentQuestion + 2}'s topic: "${topics[Math.min(test.currentQuestion + 1, topics.length - 1)]}"`}. End your response with [ADVANCE] on its own line. Ask the question ONLY ONCE — do not repeat it.

If the student's answer is too unclear or brief to assess: ask ONE brief probing follow-up about the SAME topic to get them to explain their reasoning. Do NOT add [ADVANCE]. Do NOT ask a new question about a different topic. The goal of probing is to understand HOW they think, not to teach them.

If the student is off-topic, distracting, or pasting your question back: redirect them firmly. Do NOT praise pasted answers. Do NOT add [ADVANCE] unless this is their 2nd attempt.

CRITICAL RULES:
- Do NOT repeat the same sentence or question twice. Say everything exactly once.
- Do NOT prefix with "Question N:" — just ask directly.
- Do NOT explain concepts in detail. You are testing, not teaching.
- Do NOT add behavioral observations to individual replies.
- If the student pasted your question or gave a non-answer, do NOT say "correct" or "good".
- Keep it SHORT — under 3 sentences of feedback + 1 question.]`,
      });
    }

    if (isLastMessage) {
      aiMessages.push({
        role: "user",
        content: `[LANGUAGE CHECK — Re-read the student's LATEST message. If they wrote in Roman Urdu, your ENTIRE response (including the next question or final summary) MUST be in Roman Urdu. If they wrote in English, use English. If they asked you to switch language, comply. NEVER ask them to switch to English. Technical terms stay in English.]

This is the last reply (5 of 5) for Question ${test.currentQuestion + 1} of 10. ${pasteWarning} ${avoidanceWarning} Give 1-2 sentences of brief feedback, then ${isLastQuestion ? "give the FINAL SUMMARY of the entire test (grade, concepts, psychological assessment, distraction analysis, next steps)." : `immediately ask the next question (Question ${test.currentQuestion + 2} of 10) about Day ${test.currentQuestion + 2}'s topic: "${topics[Math.min(test.currentQuestion + 1, topics.length - 1)]}". Do NOT prefix with "Question N:" — just ask directly. Do NOT add any observation lines or behavioral notes — just feedback + next question.`}]`,
      });
    }

    const examinerResponseRaw = await callAILocal(aiMessages, "weekly-test-reply", undefined, user.id);

    // Detect [ADVANCE] marker — the AI uses this to signal it wants to
    // move to the next question even before 5 replies are used up.
    const wantsAdvance = examinerResponseRaw.includes("[ADVANCE]");
    // Strip [ADVANCE] marker AND any "Question N:" prefix the AI might add
    let examinerResponse = examinerResponseRaw.replace(/\s*\[ADVANCE\]\s*/g, "").trim();
    examinerResponse = examinerResponse.replace(/^Question\s*\d+\s*:\s*/im, "").trim();
    // Remove duplicate sentences — the AI sometimes repeats a sentence
    // twice in the same response (e.g. the question text appears 2x).
    // Split by sentence-ending punctuation, deduplicate, rejoin.
    const sentences = examinerResponse.match(/[^.!?]+[.!?]+|\S+$/g) || [examinerResponse];
    const seenSentences = new Set<string>();
    const uniqueSentences = sentences.filter(s => {
      const normalized = s.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalized.length > 15 && seenSentences.has(normalized)) return false;
      seenSentences.add(normalized);
      return true;
    });
    examinerResponse = uniqueSentences.join(" ").trim();

    // Detect advancement using multiple signals:
    // 1. AI explicitly says [ADVANCE]
    // 2. 5th reply reached (isLastMessage)
    // 3. AI response contains feedback + a NEW question (detected by:
    //    response has 2+ sentences, one of which is a question, AND
    //    the response is longer than 100 chars — feedback is typically
    //    1-2 sentences, so if there's a 3rd sentence with a question,
    //    it's likely a new question)
    const responseSentences = examinerResponse.match(/[^.!?]+[.!?]+/g) || [];
    const questionSentences = responseSentences.filter(s => s.includes("?"));
    const hasFeedbackAndNewQuestion = responseSentences.length >= 2 && questionSentences.length >= 1 && examinerResponse.length > 80;

    // Additional check: if the AI said "Now," or "Let's move on" or "Next question"
    // or "Let me ask" — these are strong signals it's advancing
    const advancePhrases = ["now,", "let's move on", "next question", "let me ask", "let's talk about", "for your final", "moving on"];
    const hasAdvancePhrase = advancePhrases.some(phrase => examinerResponse.toLowerCase().includes(phrase));

    const shouldAdvance = wantsAdvance || isLastMessage || (hasFeedbackAndNewQuestion && (hasAdvancePhrase || newReplyCount >= 2));

    let nextQuestion = test.currentQuestion;
    let nextReplyCount = newReplyCount;
    let isComplete = false;

    // Per-question explanation: when the examiner advances (shouldAdvance=true),
    // grade the question that JUST ended (test.currentQuestion) and attach the
    // explanation to the examiner's advancing message. The student sees it
    // immediately in the chat — they don't wait for the whole test to finish.
    let perQuestionExplanation: QuestionExplanation | undefined;
    if (shouldAdvance) {
      const questionJustEnded = conversation
        .filter(m => m.role === "examiner" && m.questionIndex === test.currentQuestion)
        .map(m => m.content)
        .join(" ");
      const studentAnswersToThisQuestion = conversation
        .filter(m => m.role === "student" && m.questionIndex === test.currentQuestion)
        .map(m => m.content);
      if (questionJustEnded && studentAnswersToThisQuestion.length > 0) {
        perQuestionExplanation = await gradeOneQuestion({
          question: questionJustEnded,
          studentAnswers: studentAnswersToThisQuestion,
          topic: topics[Math.min(test.currentQuestion, topics.length - 1)] || `Week ${week}`,
          testKind: "weekly_test",
          studentName: user.name,
        });
      }
    }

    if (shouldAdvance) {
      if (isLastQuestion) {
        isComplete = true;
        const questionsAnswered = test.currentQuestion + 1;
        const analysis = await generateFinalAnalysis(conversation, user.name, week, phase, topics, user.id);
        conversation.push({
          role: "examiner", content: examinerResponse,
          timestamp: new Date().toISOString(), questionIndex: test.currentQuestion,
          questionExplanation: perQuestionExplanation,
        });
        // TRANSACTION: mark the test completed AND advance the student's week
        // atomically. Without this, a failure between the two queries leaves
        // the student with a completed test but stuck on the same week forever
        // (they can't retake, can't advance, can't see next-week content).
        // Phase Plagiarism: apply score deduction BEFORE storing.
        const plagiarismResult = applyPlagiarismDeduction(analysis.score, analysis.plagiarismScore);
        await db.$transaction(async (tx) => {
          await tx.weeklyTest.update({
            where: { id: test.id },
            data: {
              status: "completed",
              completedAt: new Date(),
              conversation: JSON.stringify(conversation),
              score: plagiarismResult.finalScore, // DEDUCTED score
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
        }).catch(() => {/* Non-blocking — best-effort logging */});

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

    // Tag the examiner's message with the correct question index.
    // For mid-test advances (not last question, not complete), attach the
    // per-question explanation here — the last-question branch already
    // attached it inside its own push above.
    const msgQuestionIndex = nextQuestion;
    conversation.push({
      role: "examiner", content: examinerResponse,
      timestamp: new Date().toISOString(), questionIndex: msgQuestionIndex,
      ...(perQuestionExplanation && !isComplete ? { questionExplanation: perQuestionExplanation } : {}),
    });

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
    const analysis = await generateFinalAnalysis(conversation, user.name, week, phase, topics, user.id);
    // TRANSACTION: same atomicity guarantee as the natural-completion path
    // above — see the comment there for why this matters.
    // Phase Plagiarism: apply score deduction BEFORE storing.
    const plagiarismResult = applyPlagiarismDeduction(analysis.score, analysis.plagiarismScore);
    await db.$transaction(async (tx) => {
      await tx.weeklyTest.update({
        where: { id: test.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          conversation: JSON.stringify(conversation),
          score: plagiarismResult.finalScore, // DEDUCTED score
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

/** Call AI via shared ai-provider.ts — catches errors and returns a
 *  fallback prompt so a single AI failure doesn't crash the whole test. */
async function callAILocal(messages: { role: string; content: string }[], feature: string, maxTokens?: number, userId?: string): Promise<string> {
  try {
    const result = await callAI(
      messages.map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
      { temperature: 0.5, maxTokens: maxTokens ?? TOKEN_BUDGET.WEEKLY_TEST_REPLY, feature, userId }
    );
    if (result.text) return sanitizeExaminerText(result.text);
  } catch (err) {
    logger.warn("Weekly test AI call failed", { feature, error: err instanceof Error ? err.message : String(err) });
  }
  return "Can you elaborate on that? Walk me through your reasoning.";
}

/** Generate final analysis — uses course-aligned context.
 *  Returns the AI's assessment + weaknesses + per-answer plagiarism breakdown
 *  + engagement feedback. All of this is stored on the WeeklyTest row and
 *  surfaced to the student (constructive version) and teacher (full detail). */
async function generateFinalAnalysis(
  conversation: ChatMessage[],
  studentName: string,
  week: number,
  phase: string,
  topics: string[],
  studentUserId?: string
): Promise<{
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
  const transcript = conversation
    .filter(m => m.role === "student" || m.content.includes("Observation:") || m.content.includes("Behavior:"))
    .map(m => `${m.role === "student" ? "Student" : "Examiner"}: ${m.content.slice(0, 150)}`)
    .join("\n")
    .slice(0, 2000);

  try {
    const result = await callAI([
      { role: "user", content: finalAnalysisPrompt(studentName, transcript) },
    ], { temperature: 0.3, maxTokens: TOKEN_BUDGET.FINAL_ANALYSIS, feature: "final-analysis", userId: studentUserId });
    const raw = result.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    // Store the REAL score (0-100). The previous 50% floor was pedagogically
    // dishonest — a student who answered nothing got 50, which destroyed the
    // signal for the instructor and gave the student a false sense of passing.
    // The student-facing UI now buffers low scores with a study-plan message
    // (see StudentDashboard WeeklyTestPanel). Teachers see the real score.
    const rawScore = Number(parsed.score ?? 70);
    // Guard against NaN — if the AI returns { score: null } or { score: "abc" },
    // Number() returns 0 or NaN. NaN would propagate through Math.max/min and
    // corrupt the stored score.
    const safeScore = Number.isFinite(rawScore) ? rawScore : 70;
    const clampedScore = Math.max(0, Math.min(100, safeScore));
    const rawPlagiarism = Number(parsed.plagiarismScore ?? 0);
    let clampedPlagiarism = Math.max(0, Math.min(100, rawPlagiarism));

    let plagiarismNotes = String(parsed.plagiarismNotes ?? "No signs of plagiarism detected.");

    // Parse the weaknesses array (Phase 1.6). The AI returns 1-3 specific
    // topics the student should review. We store these on the WeeklyTest row
    // and surface them to the student as a study plan in the dashboard.
    let weaknesses: string[] = [];
    try {
      const rawWeaknesses = parsed.weaknesses;
      if (Array.isArray(rawWeaknesses)) {
        weaknesses = rawWeaknesses
          .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
          .map(w => w.trim())
          .slice(0, 5); // cap at 5 — the UI doesn't need more
      }
    } catch {
      weaknesses = [];
    }

    // Phase 1.2 v2: Parse the plagiarism breakdown (per-answer analysis +
    // voice consistency + instructor note). Stored on WeeklyTest.examinerObs
    // as JSON so the instructor can review the full analysis.
    let plagiarismBreakdown: {
      voiceConsistency: string;
      perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
      strongestSignal: string;
      instructorNote: string;
    } | null = null;
    try {
      const rawBreakdown = parsed.plagiarismBreakdown;
      if (rawBreakdown && typeof rawBreakdown === "object") {
        const b = rawBreakdown as Record<string, unknown>;
        const perAnswerFlags = Array.isArray(b.perAnswerFlags)
          ? (b.perAnswerFlags as unknown[])
              .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
              .map((f, i) => ({
                questionIndex: typeof f.questionIndex === "number" ? f.questionIndex : i,
                flagged: f.flagged === true,
                reason: typeof f.reason === "string" ? f.reason : "no reason provided",
              }))
          : [];
        plagiarismBreakdown = {
          voiceConsistency: typeof b.voiceConsistency === "string" ? b.voiceConsistency : "Analysis unavailable.",
          perAnswerFlags,
          strongestSignal: typeof b.strongestSignal === "string" ? b.strongestSignal : "No concerning patterns.",
          instructorNote: typeof b.instructorNote === "string" ? b.instructorNote : "No instructor action needed.",
        };
      }
    } catch {
      plagiarismBreakdown = null;
    }

    // Phase 1.3 v2: Parse the engagement feedback (subject changes +
    // avoidance + constructive student feedback + instructor note).
    let engagementFeedback: {
      subjectChanges: number;
      avoidanceCount: number;
      distractedQuestions: number[];
      overallEngagement: string;
      studentFeedback: string;
      instructorNote: string;
    } | null = null;
    try {
      const rawEngagement = parsed.engagementFeedback;
      if (rawEngagement && typeof rawEngagement === "object") {
        const e = rawEngagement as Record<string, unknown>;
        engagementFeedback = {
          subjectChanges: typeof e.subjectChanges === "number" ? e.subjectChanges : 0,
          avoidanceCount: typeof e.avoidanceCount === "number" ? e.avoidanceCount : 0,
          distractedQuestions: Array.isArray(e.distractedQuestions)
            ? (e.distractedQuestions as unknown[]).filter((n): n is number => typeof n === "number")
            : [],
          overallEngagement: typeof e.overallEngagement === "string" ? e.overallEngagement : "unknown",
          studentFeedback: typeof e.studentFeedback === "string" ? e.studentFeedback : "Engagement analysis unavailable.",
          instructorNote: typeof e.instructorNote === "string" ? e.instructorNote : "No concerns.",
        };
      }
    } catch {
      engagementFeedback = null;
    }

    return {
      psychAnalysis: String(parsed.psychAnalysis || "Engagement was consistent. Cognitive load appeared moderate."),
      examinerComment: String(parsed.examinerComment || "Practitioner level. Solid fundamentals with room for deeper reasoning."),
      strengthSignal: String(parsed.strengthSignal || "You showed up and engaged with the material — that's the foundation everything else builds on."),
      score: clampedScore,
      plagiarismScore: clampedPlagiarism,
      plagiarismNotes,
      weaknesses,
      plagiarismBreakdown,
      engagementFeedback,
      feedback: parseTeachingFeedback(parsed, topics, conversation),
    };
  } catch {
    const replies = conversation.filter(m => m.role === "student").length;
    // Fallback when the AI call itself failed (network, quota, etc.).
    // Score based on engagement level — a student who replied more at least
    // engaged. The student-facing UI buffers low scores with a study plan.
    const fallbackScore = Math.max(20, Math.min(75, 30 + replies * 4));
    // Use the week's topics as fallback weaknesses — at least gives the
    // student something concrete to review.
    const fallbackWeaknesses = topics.slice(0, 3);
    return {
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

/** Parse the teaching feedback fields (modelAnswer / missedPoints /
 *  nextTime / questionExplanations) from the final-analysis AI response.
 *  Falls back to the shared fallbackGrade() when the AI didn't return
 *  them. */
function parseTeachingFeedback(
  parsed: Record<string, unknown>,
  topics: string[],
  conversation: ChatMessage[],
): TeachingFeedback {
  const topicLabel = topics[0] || "the weekly test topics";
  const replies = conversation.filter(m => m.role === "student").length;
  const fallback = fallbackGrade(topicLabel, "weekly_test", replies).feedback;

  const missedRaw = parsed.missedPoints;
  const missed = Array.isArray(missedRaw)
    ? missedRaw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map(s => s.trim())
        .slice(0, 4)
    : [];

  return {
    modelAnswer:
      typeof parsed.modelAnswer === "string" && parsed.modelAnswer.trim()
        ? parsed.modelAnswer.trim()
        : fallback.modelAnswer,
    missedPoints: missed.length > 0 ? missed : fallback.missedPoints,
    nextTime:
      typeof parsed.nextTime === "string" && parsed.nextTime.trim()
        ? parsed.nextTime.trim()
        : fallback.nextTime,
    questionExplanations: parseQuestionExplanations(parsed.questionExplanations),
  };
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
