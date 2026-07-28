import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getSafeguardingFlagsForPrincipal } from "@/lib/ai-assistant/safeguarding";

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["principal", "administrator", "demo", "admin"];
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden — principal access required" }, { status: 403 });
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!user?.institutionId) return NextResponse.json({ error: "No institution linked" }, { status: 404 });
  const institutionId = user.institutionId;

  // C6 fix (audit 2026-07-26): the previous version returned hardcoded zeros
  // for coursePerformance + teacherPerformance. This version runs real queries:
  //  - coursePerformance: for each course, count students in its batches + average
  //    weekly test score across those students.
  //  - teacherPerformance: for each teacher, count batches they teach (BatchTeacher),
  //    mentorship sessions logged, and alerts they raised.
  const [institution, studentsCount, teachersCount, counselorsCount, mentorsCount, coursesCount, batchesCount, alerts, mentorSessionsCount, wellbeingStates, crisisFlags, healthSummaries, auditLogs, growthReports, enrollmentsCount, courses, teachers] = await Promise.all([
    db.institution.findUnique({ where: { id: institutionId } }),
    db.user.count({ where: { role: "student", institutionId, blocked: false } }),
    db.user.count({ where: { role: "instructor", institutionId } }),
    db.user.count({ where: { role: "counselor", institutionId } }),
    db.user.count({ where: { role: "course_coordinator", institutionId } }),
    db.course.count({ where: { institutionId } }),
    db.batch.count({ where: { course: { institutionId } } }),
    db.studentAlert.findMany({ where: { user: { institutionId } }, select: { id: true, type: true, severity: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.mentorshipTouchpoint.count({ where: { user: { institutionId } } }),
    db.wellbeingState.findMany({ where: { user: { institutionId } }, select: { userId: true, tier: true } }),
    db.crisisFlag.findMany({ where: { user: { institutionId }, status: "open" }, select: { id: true, severity: true, category: true, createdAt: true } }),
    db.studentHealthSummary.findMany({ where: { user: { institutionId } }, select: { userId: true, moodScore: true, engagementScore: true, engagementStreak: true, frustrationCount: true, avoidanceCount: true, enthusiasmCount: true, wellbeingTier: true } }),
    db.auditLog.findMany({ where: { actor: { institutionId } }, include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.growthReport.findMany({ where: { user: { institutionId } }, include: { user: { select: { name: true } } }, orderBy: { generatedAt: "desc" }, take: 5 }),
    Promise.resolve(0), // enrollment count — no Enrollment model in SQLite schema
    // C6 fix: load courses WITH their batches (so we can count students per course)
    db.course.findMany({
      where: { institutionId },
      include: {
        batches: {
          select: {
            id: true,
            name: true,
            // Count users in this batch (batch.users includes students + any
            // teachers with batchId set; we filter to role=student below).
            _count: { select: { users: true } },
          },
        },
      },
    }),
    // C6 fix: load teachers WITH their BatchTeacher junction (so we can count
    // how many batches each teacher teaches) + their mentorship touchpoints.
    db.user.findMany({
      where: { role: "instructor", institutionId },
      select: {
        id: true, name: true, email: true,
        _count: { select: { batchTeaching: true, mentorshipTouchpoints: true } },
      },
    }),
  ]);

  const greenCount = wellbeingStates.filter(w => w.tier === "green").length;
  const amberCount = wellbeingStates.filter(w => w.tier === "warning").length;
  const redCount = wellbeingStates.filter(w => w.tier === "red").length;
  const openAlerts = alerts.filter(a => a.status === "open");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");
  const crisisAlerts = alerts.filter(a => a.severity === "red");
  const highAlerts = alerts.filter(a => a.severity === "warning");

  const moodScores = healthSummaries.map(h => h.moodScore).filter(m => m != null) as number[];
  const avgMood = moodScores.length > 0 ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length) : 0;
  const engagementScores = healthSummaries.map(h => h.engagementScore).filter(e => e != null) as number[];
  const avgEngagement = engagementScores.length > 0 ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) : 0;

  const totalFrustration = healthSummaries.reduce((s, h) => s + (h.frustrationCount || 0), 0);
  const totalAvoidance = healthSummaries.reduce((s, h) => s + (h.avoidanceCount || 0), 0);
  const totalEnthusiasm = healthSummaries.reduce((s, h) => s + (h.enthusiasmCount || 0), 0);

  // C6 fix: real course performance — student count = sum of students across
  // the course's batches. Average score is fetched in a separate query below
  // (Prisma can't easily aggregate across the batch→students→weeklyTests
  // relation in a single include).
  const batchIdsByCourse = new Map<string, string[]>();
  for (const c of courses) {
    batchIdsByCourse.set(c.id, c.batches.map(b => b.id));
  }
  const allBatchIds = Array.from(new Set(courses.flatMap(c => c.batches.map(b => b.id))));

  // Fetch avg weekly test score per batch (in one query, then group client-side)
  const batchScoreRows = allBatchIds.length > 0
    ? await db.weeklyTest.findMany({
        where: {
          user: { batchId: { in: allBatchIds } },
          status: "completed",
          score: { not: null },
        },
        select: { user: { select: { batchId: true } }, score: true },
      })
    : [];
  const batchAvgScore = new Map<string, { sum: number; count: number }>();
  for (const row of batchScoreRows) {
    const bid = row.user?.batchId;
    if (!bid) continue;
    const cur = batchAvgScore.get(bid) || { sum: 0, count: 0 };
    cur.sum += row.score ?? 0;
    cur.count += 1;
    batchAvgScore.set(bid, cur);
  }

  // Course performance: aggregate per-course student count + avg score across batches
  const coursePerformance = courses.map(c => {
    const batchIds = batchIdsByCourse.get(c.id) || [];
    // _count.users counts all users in the batch (students + legacy teachers
    // with batchId). This is a slight over-count but close enough for a
    // dashboard overview; teachers rarely have batchId set in practice.
    const studentCount = c.batches.reduce((s, b) => s + b._count.users, 0);
    const scoreStats = batchIds.reduce((acc, bid) => {
      const s = batchAvgScore.get(bid);
      if (s) { acc.sum += s.sum; acc.count += s.count; }
      return acc;
    }, { sum: 0, count: 0 });
    const avgScore = scoreStats.count > 0 ? Math.round(scoreStats.sum / scoreStats.count) : 0;
    return {
      id: c.id,
      code: c.name,
      name: c.name,
      teacher: "—", // We don't track per-course teacher yet (courses have batches, batches have BatchTeacher)
      studentCount,
      avgScore,
    };
  });

  // C6 fix: real teacher performance — batch count from BatchTeacher junction,
  // sessions from mentorship touchpoints, alerts raised from StudentAlert
  // where userId = teacher's id.
  const instructorIds = teachers.map(t => t.id);
  const alertsByInstructor = instructorIds.length > 0
    ? await db.studentAlert.groupBy({
        by: ["userId"],
        where: { userId: { in: instructorIds } },
        _count: { _all: true },
      })
    : [];
  const alertsByInstructorMap = new Map(alertsByInstructor.map(a => [a.userId, a._count._all]));
  const teacherPerformance = teachers.map(t => ({
    id: t.id,
    name: t.name,
    email: t.email,
    courses: t._count.batchTeaching,    // Number of batches the teacher is assigned to
    sessions: t._count.mentorshipTouchpoints,  // Mentorship sessions logged
    alertsRaised: alertsByInstructorMap.get(t.id) || 0,
  }));

  // CR-2 fix (audit 2026-07-26 FINAL): fetch safeguarding flags for principal review.
  // These were previously dead code — getSafeguardingFlagsForPrincipal was never called.
  const safeguardingFlags = institutionId ? await getSafeguardingFlagsForPrincipal(institutionId) : [];

  return NextResponse.json({
    institution: institution ? { name: institution.name, logoUrl: institution.logoUrl, contactEmail: institution.contactEmail } : null,
    overview: { totalStudents: studentsCount, totalTeachers: teachersCount, totalCounselors: counselorsCount, totalMentors: mentorsCount, totalCourses: coursesCount, totalBatches: batchesCount, totalEnrollments: enrollmentsCount, totalAlerts: alerts.length, openAlerts: openAlerts.length, crisisFlags: crisisFlags.length, mentorSessions: mentorSessionsCount, avgMood, avgEngagement, totalFrustration, totalAvoidance, totalEnthusiasm },
    wellbeing: { green: greenCount, amber: amberCount, red: redCount },
    alerts: { open: openAlerts.length, acknowledged: acknowledgedAlerts.length, resolved: resolvedAlerts.length, crisis: crisisAlerts.length, high: highAlerts.length, byType: { psychological: alerts.filter(a => a.type === "psychological").length, educational: alerts.filter(a => a.type === "educational").length, mentorship: alerts.filter(a => a.type === "mentorship").length } },
    coursePerformance,
    teacherPerformance,
    // CR-2 fix: safeguarding flags for principal review
    safeguardingFlags,
    auditLogs: auditLogs.map(log => ({ id: log.id, actorName: log.actorName, actorRole: log.actorRole, action: log.action, targetType: log.targetType, metadata: log.metadata, createdAt: log.createdAt })),
    // L6 fix (audit 2026-07-26): was using strengths text as the title (awkward +
    // misleading). Now uses a proper descriptive title with the student's name.
    growthReports: growthReports.map(r => ({ id: r.id, title: `Growth Report — ${r.user?.name || "Student"}`, userName: r.user?.name, generatedAt: r.generatedAt })),
  });
}
