import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { scoreToGrade } from "@/lib/constants";
import { getCourseWeekPhase, getCourseDurationWeeks } from "@/lib/course-db";

/** GET /api/students/final-result — generates (or returns cached) final result
 *  for a student based on ALL their data across the full course duration.
 *
 *  The final result includes:
 *  - Performance grade (average of weekly test scores, 50% weight + practice 50%)
 *  - Participation grade (how many of (totalWeeks * 10) total weekly questions were answered)
 *  - Behavioral pattern analysis (simple English, from AI)
 *  - Areas to improve (to become a professional)
 *  - Per-week breakdown
 *
 *  For students: auto-generates using their own ID.
 *  For teachers/admins: pass ?userId=studentId
 */
export async function GET(req: Request) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const targetUserId = (isStaffRole(payload.role)) && userIdParam
    ? userIdParam
    : payload.sub;
  // IDOR protection: verify the caller can access this student's data
  if (targetUserId !== payload.sub) {
    try {
      await assertCanAccessStudent(payload, targetUserId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    include: {
      weeklyTests: { orderBy: { week: "asc" }, take: 50 },
      interactions: { select: { week: true, correctness: true, date: true, plagiarismScore: true }, take: 500 },
      reportCards: { orderBy: { week: "asc" }, take: 50 },
      psychObs: { orderBy: { week: "asc" }, take: 100 },
      projectReports: { orderBy: { week: "asc" }, take: 50 },
      tasks: { select: { status: true, isMilestone: true, week: true }, take: 200 },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ---- Compute metrics ----
  // Course duration is per-student (depends on batch's assigned course).
  // Default = 6 weeks when no course is assigned (backward compatibility).
  const courseDurationWeeks = await getCourseDurationWeeks(targetUserId);
  const QUESTIONS_PER_WEEK = 10;
  const TOTAL_POSSIBLE_QUESTIONS = courseDurationWeeks * QUESTIONS_PER_WEEK;
  const completedTests = user.weeklyTests.filter(t => t.score !== null);

  // Count ACTUAL questions answered — someone who answered 1 question per week
  // (6 total) should have a much lower participation than someone who answered
  // all 60. Uses currentQuestion (0-indexed, so +1) for completed tests.
  let questionsAnswered = 0;
  for (const wt of user.weeklyTests) {
    if (wt.score !== null && wt) {
      // currentQuestion is 0-indexed — if it's 9, the student answered 10 questions
      // If they finished early after 3 questions, currentQuestion = 2, so 3 answered
      const answered = wt.currentQuestion > 0 ? wt.currentQuestion : 1;
      questionsAnswered += Math.min(answered, 10); // cap at 10 per week
    }
  }

  // Average plagiarism score across completed weekly tests AND practice questions
  const weeklyPlagiarismScores = completedTests
    .map(t => t.plagiarismScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const practicePlagiarismScores = user.interactions
    .map(i => i.plagiarismScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const allPlagiarismScores = [...weeklyPlagiarismScores, ...practicePlagiarismScores];
  const avgPlagiarism = allPlagiarismScores.length > 0
    ? Math.round(allPlagiarismScores.reduce((a, b) => a + b, 0) / allPlagiarismScores.length)
    : 0;

  // Performance score: average of completed weekly test scores (50%) + practice avg (50%)
  const weeklyScores = completedTests.map(t => t.score ?? 0);
  const weeklyAvg = weeklyScores.length > 0
    ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length)
    : 0;

  const practiceAvg = user.interactions.length > 0
    ? Math.round(user.interactions.reduce((a, i) => a + i.correctness, 0) / user.interactions.length)
    : 0;

  const performanceScore = weeklyScores.length > 0 && user.interactions.length > 0
    ? Math.round(weeklyAvg * 0.5 + practiceAvg * 0.5)
    : weeklyScores.length > 0
    ? weeklyAvg
    : user.interactions.length > 0
    ? practiceAvg
    : 0;

  const performanceGrade = scoreToGrade(performanceScore);

  // Participation score: how many of 60 possible questions were answered
  const participationRate = TOTAL_POSSIBLE_QUESTIONS > 0
    ? Math.round((questionsAnswered / TOTAL_POSSIBLE_QUESTIONS) * 100)
    : 0;
  const participationGrade = scoreToGrade(participationRate);

  // Practice question stats
  const totalPracticeQuestions = user.interactions.length;

  // ---- Per-week breakdown ----
  const weekBreakdown: { week: number; phase: string; weeklyTestScore: number | null; weeklyTestStatus: string; questionsAnswered: number; practiceCount: number; practiceAvg: number | null; plagiarismScore: number | null; }[] = [];
  for (let w = 1; w <= courseDurationWeeks; w++) {
    const wt = user.weeklyTests.find(t => t.week === w);
    const weekInteractions = user.interactions.filter(i => i.week === w);
    const practiceAvg = weekInteractions.length > 0
      ? Math.round(weekInteractions.reduce((a, i) => a + i.correctness, 0) / weekInteractions.length)
      : null;
    weekBreakdown.push({
      week: w,
      phase: await getCourseWeekPhase(targetUserId, w),
      weeklyTestScore: wt?.score ?? null,
      weeklyTestStatus: wt?.status ?? "not-started",
      questionsAnswered: wt?.score !== null && wt ? Math.min(wt.currentQuestion > 0 ? wt.currentQuestion : 1, QUESTIONS_PER_WEEK) : 0,
      practiceCount: weekInteractions.length,
      practiceAvg,
      plagiarismScore: wt?.plagiarismScore ?? null,
    });
  }

  // ---- Generate AI behavioral analysis ----
  // Build a summary for the AI to analyze
  const testSummariesArr: string[] = [];
  for (const t of completedTests) {
    const w = t.week;
    const phase = await getCourseWeekPhase(targetUserId, w);
    testSummariesArr.push(`Week ${w} (${phase}): Score ${t.score}%, Questions answered: ${t.currentQuestion > 0 ? t.currentQuestion : 10}/10. ${t.examinerComment || ""}`);
  }
  const testSummaries = testSummariesArr.join("\n");

  const practiceSummary = `Practice questions answered: ${totalPracticeQuestions}, Average score: ${practiceAvg}%`;

  const psychSummary = user.psychObs.length > 0
    ? user.psychObs.map(o => `Week ${o.week}: confidence=${o.confidence}, engagement=${o.engagement}, cognitiveLoad=${o.cognitiveLoad}, remarks=${o.remarks}`).join("\n")
    : "No behavioral observations recorded.";

  let aiAnalysis: {
    behavioralPattern: string;
    areasToImprove: string[];
    overallAssessment: string;
    careerReadiness: string;
  } | null = null;
  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(targetUserId, "final-result", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const result = await callAI([
      {
        role: "user",
        content: `You are analyzing a student's complete ${courseDurationWeeks}-week course performance. Write a comprehensive final assessment in SIMPLE, beginner-friendly English.

STUDENT: ${user.name}
TOTAL WEEKLY TESTS COMPLETED: ${completedTests.length} out of ${courseDurationWeeks}
TOTAL QUESTIONS ANSWERED: ${questionsAnswered} out of ${TOTAL_POSSIBLE_QUESTIONS} possible
PERFORMANCE SCORE: ${performanceScore}% (Grade ${performanceGrade})
PARTICIPATION RATE: ${participationRate}% (Grade ${participationGrade})

WEEKLY TEST RESULTS:
${testSummaries || "No weekly tests completed yet."}

PRACTICE QUESTIONS:
${practiceSummary}

BEHAVIORAL OBSERVATIONS:
${psychSummary}

Write a final assessment with these sections:
1. BEHAVIORAL PATTERN ANALYSIS (3-4 sentences in SIMPLE English: How does this student think and learn? Are they consistent? Do they engage deeply or surface-level? What patterns do you see across weeks?)
2. AREAS TO IMPROVE (3-4 specific, actionable things they should work on to become a professional web developer)
3. OVERALL ASSESSMENT (2-3 sentences: Are they ready for a junior developer role? What's their biggest strength? What's the #1 thing holding them back?)

Return ONLY a JSON object:
{
  "behavioralPattern": "<3-4 sentences in simple English>",
  "areasToImprove": ["<specific area 1>", "<specific area 2>", "<specific area 3>"],
  "overallAssessment": "<2-3 sentences>",
  "careerReadiness": "<Ready / Almost Ready / Needs More Practice>"
}`,
      },
    ], { temperature: 0.3, maxTokens: 600, feature: "final-result", userId: targetUserId });

    const raw = result.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    aiAnalysis = match ? JSON.parse(match[0]) : null;
  } catch {
    // Fallback if AI is unavailable
  }

  // Fallback analysis
  if (!aiAnalysis) {
    aiAnalysis = {
      behavioralPattern: `${user.name} has completed ${completedTests.length} out of ${courseDurationWeeks} weekly tests with an average score of ${weeklyAvg}%. ${participationRate >= 50 ? "They show consistent participation" : "They need to participate more consistently"} across the course.`,
      areasToImprove: [
        `Complete all ${courseDurationWeeks} weekly tests to get a complete assessment`,
        practiceAvg < 70 ? "Practice more questions to strengthen conceptual understanding" : "Continue practicing to maintain your level",
        weeklyAvg < 70 ? "Review weekly test topics and retake tests where scored low" : "Keep building on your solid foundation",
      ],
      overallAssessment: `${performanceScore >= 70 ? "Ready" : performanceScore >= 50 ? "Almost ready" : "Needs more practice"} for a junior developer role. ${performanceScore >= 70 ? "Strong conceptual foundation." : "Continue building skills before applying for jobs."}`,
      careerReadiness: performanceScore >= 70 ? "Ready" : performanceScore >= 50 ? "Almost Ready" : "Needs More Practice",
    };
  }

  // ---- Project reports + task stats ----
  const projectReports = user.projectReports.map(r => {
    let analysis = null;
    try { if (r.aiAnalysis) analysis = JSON.parse(r.aiAnalysis); } catch { /* ignore */ }
    return {
      id: r.id,
      week: r.week,
      reportType: r.reportType,
      reportText: r.reportText,
      aiAnalysis: analysis,
      submittedAt: r.submittedAt,
      analyzedAt: r.analyzedAt,
    };
  });

  const totalTasks = user.tasks.length;
  const completedTasks = user.tasks.filter(t => t.status === "completed").length;
  const milestones = user.tasks.filter(t => t.isMilestone).length;
  const completedMilestones = user.tasks.filter(t => t.isMilestone && t.status === "completed").length;

  return NextResponse.json({
    studentName: user.name,
    performanceScore,
    performanceGrade,
    participationRate,
    participationGrade,
    questionsAnswered,
    totalPossibleQuestions: TOTAL_POSSIBLE_QUESTIONS,
    weeklyTestsCompleted: completedTests.length,
    weeklyAvg,
    practiceAvg,
    totalPracticeQuestions,
    avgPlagiarism,
    weekBreakdown,
    behavioralPattern: aiAnalysis.behavioralPattern,
    areasToImprove: aiAnalysis.areasToImprove,
    overallAssessment: aiAnalysis.overallAssessment,
    careerReadiness: aiAnalysis.careerReadiness,
    // Project data
    projectName: user.projectName,
    projectReports,
    projectTaskStats: { totalTasks, completedTasks, milestones, completedMilestones },
    projectAnalysis: null, // populated by teacher via /api/students/[id]/generate-project-analysis
  });
}
