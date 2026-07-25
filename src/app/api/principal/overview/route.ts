import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["principal", "administrator", "developer", "admin"];
  if (!allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden — principal access required" }, { status: 403 });
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!user?.institutionId) return NextResponse.json({ error: "No institution linked" }, { status: 404 });
  const institutionId = user.institutionId;

  const [institution, studentsCount, teachersCount, counselorsCount, mentorsCount, coursesCount, batchesCount, alerts, mentorSessionsCount, wellbeingStates, crisisFlags, healthSummaries, auditLogs, growthReports, enrollmentsCount, courses, teachers] = await Promise.all([
    db.institution.findUnique({ where: { id: institutionId } }),
    db.user.count({ where: { role: "student", institutionId, blocked: false } }),
    db.user.count({ where: { role: "teacher", institutionId } }),
    db.user.count({ where: { role: "counselor", institutionId } }),
    db.user.count({ where: { role: "course_coordinator", institutionId } }),
    db.course.count({ where: { institutionId } }),
    db.batch.count({ where: { institutionId } }),
    db.studentAlert.findMany({ where: { user: { institutionId } }, select: { id: true, type: true, severity: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.mentorshipTouchpoint.count({ where: { user: { institutionId } } }),
    db.wellbeingState.findMany({ where: { user: { institutionId } }, select: { userId: true, tier: true } }),
    db.crisisFlag.findMany({ where: { user: { institutionId }, status: "open" }, select: { id: true, severity: true, category: true, createdAt: true } }),
    db.studentHealthSummary.findMany({ where: { user: { institutionId } }, select: { userId: true, moodScore: true, engagementScore: true, engagementStreak: true, frustrationCount: true, avoidanceCount: true, enthusiasmCount: true, wellbeingTier: true } }),
    db.auditLog.findMany({ where: { actor: { institutionId } }, include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.growthReport.findMany({ where: { user: { institutionId } }, include: { user: { select: { name: true } } }, orderBy: { generatedAt: "desc" }, take: 5 }),
    db.enrollment.count({ where: { course: { institutionId } } }),
    db.course.findMany({ where: { institutionId }, include: { teacher: { select: { name: true } }, _count: { select: { enrollments: true } } } }),
    db.user.findMany({ where: { role: "teacher", institutionId }, select: { id: true, name: true, email: true, _count: { select: { coursesTeaching: true, sessionsLed: true, alertsFrom: true } } } }),
  ]);

  const greenCount = wellbeingStates.filter(w => w.tier === "green").length;
  const amberCount = wellbeingStates.filter(w => w.tier === "amber").length;
  const redCount = wellbeingStates.filter(w => w.tier === "red").length;
  const openAlerts = alerts.filter(a => a.status === "open");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");
  const crisisAlerts = alerts.filter(a => a.severity === "red");
  const highAlerts = alerts.filter(a => a.severity === "amber");

  const moodScores = healthSummaries.map(h => h.moodScore).filter(m => m != null) as number[];
  const avgMood = moodScores.length > 0 ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length) : 0;
  const engagementScores = healthSummaries.map(h => h.engagementScore).filter(e => e != null) as number[];
  const avgEngagement = engagementScores.length > 0 ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) : 0;

  const totalFrustration = healthSummaries.reduce((s, h) => s + (h.frustrationCount || 0), 0);
  const totalAvoidance = healthSummaries.reduce((s, h) => s + (h.avoidanceCount || 0), 0);
  const totalEnthusiasm = healthSummaries.reduce((s, h) => s + (h.enthusiasmCount || 0), 0);

  const coursePerformance = await Promise.all(courses.map(async c => {
    const grades = await db.grade.findMany({ where: { assessment: { courseId: c.id } }, select: { marks: true, assessment: { select: { maxMarks: true } } } });
    const avgPct = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.marks / (g.assessment?.maxMarks || 1)) * 100, 0) / grades.length) : 0;
    return { id: c.id, code: c.code, name: c.name, teacher: c.teacher?.name || "Unassigned", studentCount: c._count.enrollments, avgScore: avgPct };
  }));

  const teacherPerformance = teachers.map(t => ({ id: t.id, name: t.name, email: t.email, courses: t._count.coursesTeaching, sessions: t._count.sessionsLed, alertsRaised: t._count.alertsFrom }));

  return NextResponse.json({
    institution: institution ? { name: institution.name, logoUrl: institution.logoUrl, contactEmail: institution.contactEmail } : null,
    overview: { totalStudents: studentsCount, totalTeachers: teachersCount, totalCounselors: counselorsCount, totalMentors: mentorsCount, totalCourses: coursesCount, totalBatches: batchesCount, totalEnrollments: enrollmentsCount, totalAlerts: alerts.length, openAlerts: openAlerts.length, crisisFlags: crisisFlags.length, mentorSessions: mentorSessionsCount, avgMood, avgEngagement, totalFrustration, totalAvoidance, totalEnthusiasm },
    wellbeing: { green: greenCount, amber: amberCount, red: redCount },
    alerts: { open: openAlerts.length, acknowledged: acknowledgedAlerts.length, resolved: resolvedAlerts.length, crisis: crisisAlerts.length, high: highAlerts.length, byType: { psychological: alerts.filter(a => a.type === "psychological").length, educational: alerts.filter(a => a.type === "educational").length, mentorship: alerts.filter(a => a.type === "mentorship").length } },
    coursePerformance,
    teacherPerformance,
    auditLogs: auditLogs.map(log => ({ id: log.id, actorName: log.actorName, actorRole: log.actorRole, action: log.action, targetType: log.targetType, metadata: log.metadata, createdAt: log.createdAt })),
    growthReports: growthReports.map(r => ({ id: r.id, title: r.strengths.slice(0, 60), userName: r.user?.name, generatedAt: r.generatedAt })),
  });
}
