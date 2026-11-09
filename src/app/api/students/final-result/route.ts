import { isStaffRole, normalizeRole, UserRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { scoreToGrade } from "@/lib/constants";
import { getCourseWeekPhase, getCourseDurationWeeks } from "@/lib/course-db";
import { logger } from "@/lib/logger";
import { canExposeLearnerBehavioralAnalysis } from "@/modules/instructor-portal/final-result-visibility";
import { getAuthorizedStudentCourseIds } from "@/modules/instructor-portal/student-detail-visibility";

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
      await assertCanAccessStudent(payload, targetUserId, "content_only");
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }
  }

  // A staff final-result view is course-scoped, not learner-global. Resolve
  // the same authorised-course boundary used by the portfolio endpoint and
  // fail closed if access was revoked after the initial authorisation check.
  let authorisedCourseIds: string[] | null = null;
  if (targetUserId !== payload.sub) {
    const learnerEnrollments = await db.courseEnrollment.findMany({
      where: { userId: targetUserId, role: "student" },
      select: { courseId: true },
    });
    const learnerCourseIds = learnerEnrollments.map((enrollment) => enrollment.courseId);
    const callerRole = normalizeRole(payload.role);
    let staffCourseIds: string[] = [];

    if (callerRole === UserRole.INSTRUCTOR) {
      const teachingEnrollments = await db.courseEnrollment.findMany({
        where: { userId: payload.sub, role: "instructor" },
        select: { courseId: true },
      });
      staffCourseIds = teachingEnrollments.map((enrollment) => enrollment.courseId);
      authorisedCourseIds = getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds);

      // An explicit student grant is the instructor fallback only when there
      // is no shared teaching course. It cannot widen an existing assignment.
      if (authorisedCourseIds.length === 0) {
        const grant = await db.accessGrant.findFirst({
          where: {
            granteeUserId: payload.sub,
            scopeType: "student",
            scopeId: targetUserId,
            dataScope: { in: ["full", "content_only"] },
            revokedAt: null,
          },
          select: { id: true, dataScope: true },
        });
        if (grant) authorisedCourseIds = learnerCourseIds;
      }
    } else if (callerRole === UserRole.ORG_ADMIN) {
      const adminMemberships = await db.orgMember.findMany({
        where: { userId: payload.sub, role: "admin", status: "active" },
        select: { orgId: true },
      });
      const adminOrgIds = adminMemberships.map((membership) => membership.orgId);
      if (adminOrgIds.length > 0) {
        const learnerMemberships = await db.orgMember.findMany({
          where: { userId: targetUserId, orgId: { in: adminOrgIds }, status: "active" },
          select: { orgId: true },
        });
        const sharedOrgIds = learnerMemberships.map((membership) => membership.orgId);
        if (sharedOrgIds.length > 0) {
          const orgCourses = await db.orgCourse.findMany({
            where: { orgId: { in: sharedOrgIds } },
            select: { courseId: true },
          });
          staffCourseIds = orgCourses.map((course) => course.courseId);
        }
      }
      authorisedCourseIds = getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds);
    } else if (callerRole === UserRole.PLATFORM_ADMIN) {
      // Platform admins retain global operational access, bounded to the
      // learner's actual course enrolments.
      authorisedCourseIds = learnerCourseIds;
    } else {
      // Demo/other staff roles rely on an explicit student grant. Re-read it
      // here so a grant revoked after assertCanAccessStudent fails closed.
      const grant = await db.accessGrant.findFirst({
        where: {
          granteeUserId: payload.sub,
          scopeType: "student",
          scopeId: targetUserId,
          dataScope: { in: ["full", "content_only"] },
          revokedAt: null,
        },
        select: { id: true, dataScope: true },
      });
      if (grant) authorisedCourseIds = learnerCourseIds;
    }

    if (!authorisedCourseIds || authorisedCourseIds.length === 0) {
      return NextResponse.json(
        { error: "No authorised course records are available for this learner" },
        { status: 403 },
      );
    }
  }

  // Learners retain their own cross-course view. Staff relations are all
  // filtered by the exact authorised course set; null/unattributed records
  // are intentionally excluded from staff responses.
  const courseScopeWhere = authorisedCourseIds
    ? { courseId: { in: authorisedCourseIds } }
    : undefined;
  const user = await db.user.findUnique({
    where: { id: targetUserId },
    include: {
      weeklyTests: {
        ...(courseScopeWhere ? { where: courseScopeWhere } : {}),
        orderBy: { week: "asc" },
        take: 50,
      },
      interactions: {
        ...(courseScopeWhere ? { where: courseScopeWhere } : {}),
        select: { week: true, correctness: true, date: true, plagiarismScore: true },
        take: 500,
      },
      reportCards: {
        ...(courseScopeWhere ? { where: courseScopeWhere } : {}),
        orderBy: { week: "asc" },
        take: 50,
      },
      projectReports: {
        ...(courseScopeWhere ? { where: courseScopeWhere } : {}),
        orderBy: { week: "asc" },
        take: 50,
      },
      tasks: {
        ...(courseScopeWhere ? { where: courseScopeWhere } : {}),
        select: { status: true, isMilestone: true, week: true },
        take: 200,
      },
    },
  });

  if (!user || (targetUserId !== payload.sub && normalizeRole(user.role) !== UserRole.LEARNER)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
  // Phase lookups are DB-only + independent — fetch in PARALLEL
  // (2026-08-15) instead of one await per week.
  const phases = await Promise.all(
    Array.from({ length: courseDurationWeeks }, (_, i) => getCourseWeekPhase(targetUserId, i + 1)),
  );
  for (let w = 1; w <= courseDurationWeeks; w++) {
    const wt = user.weeklyTests.find(t => t.week === w);
    const weekInteractions = user.interactions.filter(i => i.week === w);
    const practiceAvg = weekInteractions.length > 0
      ? Math.round(weekInteractions.reduce((a, i) => a + i.correctness, 0) / weekInteractions.length)
      : null;
    weekBreakdown.push({
      week: w,
      phase: phases[w - 1] ?? `Week ${w}`,
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
  const testSummariesArr = await Promise.all(
    completedTests.map(async (t) => {
      const phase = await getCourseWeekPhase(targetUserId, t.week);
      return `Week ${t.week} (${phase}): Score ${t.score}%, Questions answered: ${t.currentQuestion > 0 ? t.currentQuestion : 10}/10.`;
    }),
  );
  const testSummaries = testSummariesArr.join("\n");

  const practiceSummary = `Practice questions answered: ${totalPracticeQuestions}, Average score: ${practiceAvg}%`;

  let aiAnalysis: {
    behavioralPattern: string;
    areasToImprove: string[];
    overallAssessment: string;
    careerReadiness: string;
  } | null = null;
  // Behavioural analysis is private learner-support information. Until an
  // explicit, consented support-data grant is implemented, never generate or
  // return it when staff view another learner (including platform admins).
  if (canExposeLearnerBehavioralAnalysis(payload.sub, targetUserId)) {
    try {
      // H1 fix: enforce per-user daily AI rate limit + demo block
      const isDemo = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
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

  // LO-5 fix: audit log for AI-driven final result generation
  await logAudit({
    actor: { id: payload.sub, name: payload.name, role: payload.role },
    action: AuditAction.FINAL_RESULT_GENERATED,
    target: { type: "user", id: targetUserId },
    after: { performanceScore, performanceGrade, careerReadiness: aiAnalysis?.careerReadiness },
  }).catch((err) => { logger.warn("Operation failed", { err }); });

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
    ...(canExposeLearnerBehavioralAnalysis(payload.sub, targetUserId)
      ? { behavioralPattern: aiAnalysis.behavioralPattern }
      : {}),
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
