import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/counselor/overview
 *
 * Purpose-built endpoint for counselors handling 1000 students.
 * Returns everything a counselor needs in a single call:
 *
 * - Caseload stats (total, by tier, open crises, open alerts)
 * - Crisis queue (open crisis flags, sorted by severity)
 * - Alert queue (open StudentAlerts, sorted by severity)
 * - Wellbeing distribution (green/amber/red counts)
 * - Follow-ups due (MentorshipTouchpoints with followUpDate in next 7 days)
 * - Recent touchpoints (last 20 across all students)
 * - Top concerns (students with highest attention scores)
 * - Batch-level psych signal summary (frustration/avoidance/enthusiasm counts)
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Counselors, principals, admins, demo can access
  const allowedRoles = ["counselor", "principal", "administrator", "demo", "admin"];
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden — counselor access required" }, { status: 403 });
  }

  // CR-6 fix (audit 2026-07-26 FINAL): add institutionId filter — was loading
  // ALL students globally with no scoping, leaking cross-institution data.
  const counselor = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!counselor?.institutionId) {
    return NextResponse.json({ error: "No institution assigned to your account." }, { status: 403 });
  }
  const institutionId = counselor.institutionId;

  // Get students scoped to the counselor's institution
  const students = await db.user.findMany({
    where: { role: "student", blocked: false, institutionId },
    select: {
      id: true, name: true, email: true, currentWeek: true,
      batchId: true, lastLogin: true,
    },
    orderBy: { name: "asc" },
  });

  const studentIds = students.map(s => s.id);

  // Parallel fetch all counselor-relevant data
  const [
    wellbeingStates,
    crisisFlags,
    studentAlerts,
    healthSummaries,
    touchpoints,
    psychEvidence,
    caseReviews,
  ] = await Promise.all([
    // All wellbeing states
    db.wellbeingState.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, tier: true, reasonsJson: true, updatedAt: true },
    }),

    // Open crisis flags
    db.crisisFlag.findMany({
      where: { userId: { in: studentIds }, status: { in: ["open", "acknowledged"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, userId: true, flaggedBy: true, category: true, severity: true, status: true, createdAt: true, resolvedAt: true },
    }),

    // Open student alerts
    db.studentAlert.findMany({
      where: { userId: { in: studentIds }, status: "open" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, userId: true, type: true, severity: true, reason: true, metric: true, metricValue: true, status: true, createdAt: true },
    }),

    // Health summaries (for aggregate stats)
    db.studentHealthSummary.findMany({
      where: { userId: { in: studentIds } },
      select: {
        userId: true, wellbeingTier: true, moodScore: true, engagementScore: true,
        engagementStreak: true, frustrationCount: true, avoidanceCount: true, enthusiasmCount: true,
        lastActiveDate: true, tutorMessagesThisWeek: true, testsThisWeek: true,
      },
    }),

    // Recent touchpoints + follow-ups due
    db.mentorshipTouchpoint.findMany({
      where: { userId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, userId: true, actorUserId: true, type: true, note: true,
        outcome: true, followUpDate: true, createdAt: true,
      },
    }),

    // Psych evidence (for batch-level signal summary)
    db.psychEvidence.findMany({
      where: { userId: { in: studentIds }, createdAt: { gt: new Date(Date.now() - 7 * 86400000) } },
      select: { userId: true, dimension: true, value: true, createdAt: true },
    }),

    // Case reviews
    db.caseReview.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, patternSummary: true, status: true, createdAt: true, postedBy: true },
    }),
  ]);

  // Build student lookup map
  const studentMap = new Map(students.map(s => [s.id, s]));
  const wellbeingMap = new Map(wellbeingStates.map(w => [w.userId, w]));
  const healthMap = new Map(healthSummaries.map(h => [h.userId, h]));

  // ---- Compute caseload stats ----
  const greenCount = wellbeingStates.filter(w => w.tier === "green").length;
  const amberCount = wellbeingStates.filter(w => w.tier === "warning").length;
  const redCount = wellbeingStates.filter(w => w.tier === "red").length;
  const openCrisisCount = crisisFlags.filter(c => c.status === "open").length;
  const openAlertCount = studentAlerts.length;

  // ---- Build crisis queue ----
  const crisisQueue = crisisFlags.map(flag => {
    const student = studentMap.get(flag.userId);
    const wellbeing = wellbeingMap.get(flag.userId);
    return {
      flagId: flag.id,
      studentId: flag.userId,
      studentName: student?.name || "Unknown",
      studentEmail: student?.email || "",
      category: flag.category,
      severity: flag.severity,
      status: flag.status,
      wellbeingTier: wellbeing?.tier || "green",
      createdAt: flag.createdAt,
    };
  });

  // ---- Build alert queue ----
  const alertQueue = studentAlerts.map(alert => {
    const student = studentMap.get(alert.userId);
    const wellbeing = wellbeingMap.get(alert.userId);
    return {
      alertId: alert.id,
      studentId: alert.userId,
      studentName: student?.name || "Unknown",
      studentEmail: student?.email || "",
      type: alert.type,
      severity: alert.severity,
      reason: alert.reason,
      metric: alert.metric,
      metricValue: alert.metricValue,
      wellbeingTier: wellbeing?.tier || "green",
      createdAt: alert.createdAt,
    };
  });

  // ---- Follow-ups due (next 7 days) ----
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
  const followUpsDue = touchpoints
    .filter(t => t.followUpDate && new Date(t.followUpDate) <= sevenDaysFromNow && new Date(t.followUpDate) >= now)
    .map(t => {
      const student = studentMap.get(t.userId);
      return {
        touchpointId: t.id,
        studentId: t.userId,
        studentName: student?.name || "Unknown",
        type: t.type,
        note: t.note,
        outcome: t.outcome,
        followUpDate: t.followUpDate,
        createdAt: t.createdAt,
      };
    })
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime());

  // ---- Recent touchpoints ----
  const recentTouchpoints = touchpoints.slice(0, 20).map(t => {
    const student = studentMap.get(t.userId);
    return {
      touchpointId: t.id,
      studentId: t.userId,
      studentName: student?.name || "Unknown",
      type: t.type,
      note: t.note,
      outcome: t.outcome,
      followUpDate: t.followUpDate,
      createdAt: t.createdAt,
    };
  });

  // ---- Top concerns (students with red tier or multiple alerts) ----
  const alertCountsByStudent = new Map<string, number>();
  studentAlerts.forEach(a => {
    alertCountsByStudent.set(a.userId, (alertCountsByStudent.get(a.userId) || 0) + 1);
  });

  const topConcerns = students
    .map(s => {
      const wellbeing = wellbeingMap.get(s.id);
      const alertCount = alertCountsByStudent.get(s.id) || 0;
      const health = healthMap.get(s.id);
      const crisisFlag = crisisFlags.find(c => c.userId === s.id && c.status === "open");
      const score = (wellbeing?.tier === "red" ? 50 : 0) + (crisisFlag ? 30 : 0) + (alertCount * 10) + ((health?.frustrationCount || 0) * 2) + ((health?.avoidanceCount || 0) * 2);
      return {
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        wellbeingTier: wellbeing?.tier || "green",
        alertCount,
        hasCrisisFlag: !!crisisFlag,
        moodScore: health?.moodScore ?? null,
        engagementScore: health?.engagementScore ?? null,
        frustrationCount: health?.frustrationCount || 0,
        avoidanceCount: health?.avoidanceCount || 0,
        enthusiasmCount: health?.enthusiasmCount || 0,
        concernScore: score,
        reasons: wellbeing?.reasonsJson ? JSON.parse(wellbeing.reasonsJson) : [],
      };
    })
    .filter(s => s.concernScore > 0)
    .sort((a, b) => b.concernScore - a.concernScore)
    .slice(0, 20);

  // ---- Batch-level psych signal summary ----
  const psychSummary = {
    totalEvidence: psychEvidence.length,
    byDimension: {} as Record<string, Record<string, number>>,
  };
  psychEvidence.forEach(e => {
    if (!psychSummary.byDimension[e.dimension]) {
      psychSummary.byDimension[e.dimension] = {};
    }
    const dim = psychSummary.byDimension[e.dimension];
    dim[e.value] = (dim[e.value] || 0) + 1;
  });

  // ---- Aggregate mood/engagement stats ----
  const moodScores = healthSummaries.map(h => h.moodScore).filter(m => m != null) as number[];
  const engagementScores = healthSummaries.map(h => h.engagementScore).filter(e => e != null) as number[];
  const avgMood = moodScores.length > 0 ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length) : 0;
  const avgEngagement = engagementScores.length > 0 ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) : 0;
  const totalFrustration = healthSummaries.reduce((sum, h) => sum + (h.frustrationCount || 0), 0);
  const totalAvoidance = healthSummaries.reduce((sum, h) => sum + (h.avoidanceCount || 0), 0);
  const totalEnthusiasm = healthSummaries.reduce((sum, h) => sum + (h.enthusiasmCount || 0), 0);

  return NextResponse.json({
    caseload: {
      totalStudents: students.length,
      greenCount,
      amberCount,
      redCount,
      openCrisisCount,
      openAlertCount,
      followUpsDueCount: followUpsDue.length,
      avgMood,
      avgEngagement,
      totalFrustration,
      totalAvoidance,
      totalEnthusiasm,
    },
    crisisQueue,
    alertQueue,
    followUpsDue,
    recentTouchpoints,
    topConcerns,
    psychSummary,
    caseReviews,
  });
}
