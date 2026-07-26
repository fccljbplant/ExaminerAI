import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { getAuthUser } from "@/lib/auth";

/** GET /api/students/[id]/portfolio — full student portfolio for teachers/admins.
 *
 *  Returns the student's project tasks, recent daily logs, recent AI
 *  interactions, bugs, and existing teacher comments. This is what the
 *  teacher sees when they click into a student from the batch dashboard.
 *
 *  Admins impersonating teachers (via ?as=teacher) can also access this.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // N2-fix: track the dataScope for response filtering.
  // null = full access (admin or teacher in own batch). Otherwise it's
  // the grant's scope (full, wellbeing_only, crisis_only, content_only).
  let portfolioDataScope: string | null = null;

  // Phase 0.4 fix: IDOR protection. Teachers can only access students in
  // their own batch. Admins can access any student. This prevents a teacher
  // from reading another teacher's students' data.
  // H3-security fix: counselor/coordinator/demo now need an AccessGrant
  // — previously they fell through with no check at all.
  // N5-fix: legacy teachers (null batch) now also need an AccessGrant —
  // previously they could see all students institution-wide.
  let needsGrantCheck = false;

  if (hasRole(payload.role, ADMIN_ROLES)) {
    // Admins — full access, no check needed
  } else if (payload.role === "teacher" ) {
    const teacher = await db.user.findUnique({
      where: { id: payload.sub },
      select: { batchId: true },
    });
    const studentCheck = await db.user.findUnique({
      where: { id },
      select: { batchId: true, role: true },
    });
    if (!studentCheck || studentCheck.role !== "student") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    const teacherBatchIds = await getTeacherBatchIds(payload.sub, payload.role);
    if (teacherBatchIds !== null) {
      if (teacherBatchIds.length === 0 || (studentCheck.batchId && !teacherBatchIds.includes(studentCheck.batchId))) {
        return NextResponse.json({ error: "This student is not in your batch" }, { status: 403 });
      }
    } else {
      // Legacy teacher with no batch — needs an AccessGrant (N5-fix)
      needsGrantCheck = true;
    }
  } else {
    // counselor, course_coordinator, demo — need an AccessGrant
    needsGrantCheck = true;
  }

  if (needsGrantCheck) {
    const grant = await db.accessGrant.findFirst({
      where: {
        granteeUserId: payload.sub,
        scopeType: "student",
        scopeId: id,
        dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },
        revokedAt: null,
      },
    });
    if (!grant) {
      return NextResponse.json({ error: "You need an access grant to view this student" }, { status: 403 });
    }
    // N2-fix: capture the grant's dataScope for response filtering below.
    // A counselor with "content_only" should NOT see psychObs or crisis data.
    // A counselor with "crisis_only" should NOT see project content.
    portfolioDataScope = grant.dataScope;
  }

  const student = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      currentWeek: true,
      createdAt: true,
      lastLogin: true,
      // HI-9 fix: include projectDurationWeeks so the portfolio header can show
      // "Week X / N" instead of the hardcoded "Week X / 6".
      projectDurationWeeks: true,
    },
  });

  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const [tasks, dailyLogs, interactions, comments, weeklyTests, competencies, psychObs, reportCards] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
    }),
    db.dailyLog.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
      take: 10,
    }),
    db.interaction.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
      take: 15,
    }),
    db.comment.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      include: { teacher: { select: { name: true, email: true } } },
    }),
    db.weeklyTest.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
      // Phase 1.2 v2 + 1.3 v2: include examinerObs (contains the full analysis
      // breakdown as JSON) + weaknesses so the teacher portfolio view can show
      // the per-answer plagiarism analysis + engagement feedback + study plan.
      select: { id: true, week: true, status: true, score: true, completedAt: true, psychAnalysis: true, examinerComment: true, retakeAllowed: true, plagiarismScore: true, examinerObs: true, weaknesses: true, conversation: true },
    }),
    db.competency.findMany({
      where: { userId: id },
      orderBy: { score: "asc" },
    }),
    db.psychologyObs.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
    }),
    db.reportCard.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
    }),
  ]);

  // Compute project progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasProject = totalTasks > 0;

  // Compute behavioral trend summary from PsychologyObs
  const psychTrend = computePsychTrend(psychObs);

  // N2-fix: filter the response based on the grant's dataScope.
  // - full: everything (default for admins + teachers in own batch)
  // - wellbeing_only: psychObs + psychTrend + dailyLogs only (no project content)
  // - crisis_only: psychObs + psychTrend only (no project, no daily logs)
  // - content_only: tasks + reportCards + interactions only (no psychObs, no psychTrend)
  const canSeePsych = !portfolioDataScope || portfolioDataScope === "full" || portfolioDataScope === "wellbeing_only" || portfolioDataScope === "crisis_only";
  const canSeeContent = !portfolioDataScope || portfolioDataScope === "full" || portfolioDataScope === "content_only";
  const canSeeWellbeing = !portfolioDataScope || portfolioDataScope === "full" || portfolioDataScope === "wellbeing_only";

  return NextResponse.json({
    student,
    hasProject,
    progress,
    // Always return empty arrays/objects (never undefined) so UI never has to null-check.
    // The `dataScope` field tells the client what was filtered out.
    taskSummary: canSeeContent ? {
      total: totalTasks,
      completed: completedTasks,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      planned: tasks.filter((t) => t.status === "planned").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    } : { total: 0, completed: 0, inProgress: 0, planned: 0, blocked: 0 },
    tasks: canSeeContent ? tasks : [],
    dailyLogs: canSeeWellbeing ? dailyLogs : [],
    interactions: canSeeContent ? interactions : [],
    // bugs: removed (Bug model deleted — feature never built out)
    comments,
    weeklyTests: canSeeContent ? weeklyTests : [],
    competencies: canSeeContent ? competencies : [],
    psychObs: canSeePsych ? psychObs : [],
    psychTrend: canSeePsych ? psychTrend : { weeks: [], trajectory: "insufficient-data" as const, needsAttention: false, attentionReasons: [] },
    reportCards: canSeeContent ? reportCards : [],
    dataScope: portfolioDataScope,  // so the client knows what was filtered
  });
}

/** Compute a longitudinal behavioral trend from PsychologyObs entries.
 *  Returns per-week signals + an overall trajectory + flags for the
 *  teacher dashboard's "needs attention" logic. */
function computePsychTrend(obs: {
  week: number;
  confidence: string;
  cognitiveLoad: string;
  metacognitive: string;
  communication: string;
  engagement: string;
  learningCurve: string;
  remarks: string;
}[]): {
  weeks: { week: number; confidence: string; cognitiveLoad: string; metacognitive: string; engagement: string }[];
  latest?: { confidence: string; cognitiveLoad: string; metacognitive: string; engagement: string };
  trajectory: "improving" | "stable" | "declining" | "insufficient-data";
  needsAttention: boolean;
  attentionReasons: string[];
} {
  if (obs.length === 0) {
    return {
      weeks: [],
      trajectory: "insufficient-data",
      needsAttention: false,
      attentionReasons: [],
    };
  }

  const weeks = obs.map(o => ({
    week: o.week,
    confidence: o.confidence,
    cognitiveLoad: o.cognitiveLoad,
    metacognitive: o.metacognitive,
    engagement: o.engagement,
  }));

  const latest = weeks[weeks.length - 1];

  // Trajectory: compare first half vs second half confidence + cognitiveLoad
  const confidenceRank = { low: 1, moderate: 2, high: 3 };
  const loadRank = { low: 1, moderate: 2, high: 3 };
  const firstHalf = obs.slice(0, Math.ceil(obs.length / 2));
  const secondHalf = obs.slice(Math.ceil(obs.length / 2));
  const avgFirstConf = firstHalf.reduce((a, o) => a + (confidenceRank[o.confidence as keyof typeof confidenceRank] ?? 2), 0) / firstHalf.length;
  const avgSecondConf = secondHalf.reduce((a, o) => a + (confidenceRank[o.confidence as keyof typeof confidenceRank] ?? 2), 0) / secondHalf.length;
  const avgFirstLoad = firstHalf.reduce((a, o) => a + (loadRank[o.cognitiveLoad as keyof typeof loadRank] ?? 2), 0) / firstHalf.length;
  const avgSecondLoad = secondHalf.reduce((a, o) => a + (loadRank[o.cognitiveLoad as keyof typeof loadRank] ?? 2), 0) / secondHalf.length;

  let trajectory: "improving" | "stable" | "declining" | "insufficient-data";
  if (obs.length < 2) {
    trajectory = "insufficient-data";
  } else if (avgSecondConf > avgFirstConf && avgSecondLoad <= avgFirstLoad) {
    trajectory = "improving";
  } else if (avgSecondConf < avgFirstConf || avgSecondLoad > avgFirstLoad) {
    trajectory = "declining";
  } else {
    trajectory = "stable";
  }

  // Attention flags: declining trend, sustained high load, sustained low confidence
  const attentionReasons: string[] = [];
  const recentObs = obs.slice(-3); // last 3 entries
  const recentHighLoad = recentObs.filter(o => o.cognitiveLoad === "high").length;
  const recentLowConf = recentObs.filter(o => o.confidence === "low").length;
  if (trajectory === "declining") attentionReasons.push("Declining confidence or rising cognitive load trend");
  if (recentHighLoad >= 2) attentionReasons.push("Sustained high cognitive load in recent sessions");
  if (recentLowConf >= 2) attentionReasons.push("Sustained low confidence in recent sessions");
  if (latest?.engagement === "low") attentionReasons.push("Latest session showed low engagement");

  return {
    weeks,
    latest,
    trajectory,
    needsAttention: attentionReasons.length > 0,
    attentionReasons,
  };
}
