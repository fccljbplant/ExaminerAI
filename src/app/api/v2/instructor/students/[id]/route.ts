/**
 * GET /api/v2/instructor/students/[id] — I6 Student drill-down aggregate
 * (REDESIGN-P3 §I6, W10 rebuild)
 *
 * Full student picture for the instructor on the v2 envelope, backed by
 * the same data the v1 portfolio served (kept routes/data — the v1 UI
 * panels were the casualty of cutover, never the data):
 *   - identity + enrollment
 *   - academic: weekly tests, report cards, competencies, daily check-ins
 *   - project: task summary + task list
 *   - certificates (verify links)
 *   - academic attention signals (Phase-1 compliant: no psych layer)
 *   - recent engagement events
 *
 * IDOR guard: the caller must teach a course the student is enrolled in.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";
import { normalizeRole, UserRole } from "@/lib/rbac";

export const runtime = "nodejs";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  const role = normalizeRole(user.role);
  if (role !== UserRole.INSTRUCTOR && role !== UserRole.ORG_ADMIN) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { id } = await params;

  // Build the caller's authorised course set before reading learner records.
  // Org admins are restricted to active organisation memberships and courses.
  let authorisedCourseIds: string[] = [];
  if (role === UserRole.INSTRUCTOR) {
    const teaching = await db.courseEnrollment.findMany({
      where: { userId: user.sub, role: "instructor" },
      select: { courseId: true },
    });
    authorisedCourseIds = teaching.map((course) => course.courseId);
  } else if (role === UserRole.ORG_ADMIN) {
    const memberships = await db.orgMember.findMany({
      where: { userId: user.sub, role: "admin", status: "active" },
      select: { orgId: true },
    });
    const orgIds = memberships.map((membership) => membership.orgId);
    const orgCourses = orgIds.length
      ? await db.orgCourse.findMany({
          where: { orgId: { in: orgIds } },
          select: { courseId: true },
        })
      : [];
    authorisedCourseIds = orgCourses.map((course) => course.courseId);
  }

  if (authorisedCourseIds.length === 0) {
    return apiError("You do not have access to this learner", "FORBIDDEN", 403);
  }

  const learnerEnrollments = await db.courseEnrollment.findMany({
    where: { userId: id, role: "student", courseId: { in: authorisedCourseIds } },
    select: { courseId: true },
  });
  const sharedCourseIds = [...new Set(learnerEnrollments.map((course) => course.courseId))];
  if (sharedCourseIds.length === 0) {
    return apiError("You do not teach this student", "FORBIDDEN", 403);
  }

  const student = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, lastLogin: true, createdAt: true },
  });
  if (!student || normalizeRole(student.role) !== UserRole.LEARNER) {
    return apiError("Student not found", "NOT_FOUND", 404);
  }

  const courseScope = { courseId: { in: sharedCourseIds } };

  const [weeklyTests, reportCards, dailyLogs, tasks, certificates, events, projects] =
    await Promise.all([
      db.weeklyTest.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { week: "asc" },
        select: {
          week: true,
          score: true,
          status: true,
          completedAt: true,
          plagiarismScore: true,
          strengths: true,
          weaknesses: true,
          nextAction: true,
          retakeAllowed: true,
          conversation: true,
        },
      }),
      db.reportCard.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { date: "desc" },
        take: 10,
      }),
      db.dailyLog.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { date: "desc" },
        take: 14,
        select: { date: true },
      }),
      db.projectTask.findMany({
        where: { userId: id, ...courseScope },
        orderBy: [{ week: "asc" }, { createdAt: "asc" }],
        select: { id: true, description: true, status: true, week: true },
      }),
      db.certificate.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { issuedAt: "desc" },
        select: { id: true, courseName: true, grade: true, score: true, issuedAt: true, verifyToken: true },
      }),
      db.engagementEvent.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { eventType: true, createdAt: true },
      }),
      db.learnProject.findMany({
        where: { userId: id, ...courseScope },
        orderBy: { updatedAt: "desc" },
        include: { tasks: { select: { id: true, status: true } } },
      }),
    ]);

  // SkillMastery has no courseId in the current schema, so it cannot be
  // safely included in a course-scoped drill-down. Psychology/calibration
  // signals remain unavailable until consent and organisation gates exist.
  const competencies: Array<{ topic: string; masteryLevel: string }> = [];

  // Academic attention signals (Phase-1 compliant — no psych layer).
  const attentionReasons: string[] = [];
  let attentionScore = 0;
  const lastLog = dailyLogs[0]?.date;
  if (lastLog) {
    const days = Math.floor((Date.now() - new Date(lastLog).getTime()) / 86_400_000);
    if (days >= 3) {
      attentionScore += 30;
      attentionReasons.push(`Inactive ${days} days`);
    } else if (days >= 2) {
      attentionScore += 15;
      attentionReasons.push(`Inactive ${days} days`);
    }
  }
  const scored = weeklyTests.filter((t) => t.score !== null);
  const latest = scored[scored.length - 1];
  if (latest && (latest.score ?? 0) < 60) {
    attentionScore += 25;
    attentionReasons.push(`Last test ${latest.score}%`);
  }
  if (scored.length >= 2) {
    const lastTwo = scored.slice(-2).map((t) => t.score ?? 0);
    if (lastTwo[1] < lastTwo[0] - 15) {
      attentionScore += 15;
      attentionReasons.push("Test scores declining");
    }
  }
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  return apiSuccess({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      lastLogin: student.lastLogin?.toISOString() ?? null,
      joinedAt: student.createdAt.toISOString(),
    },
    courseId: sharedCourseIds[0],
    courseIds: sharedCourseIds,
    kpis: {
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      tasksDone: `${completedTasks}/${totalTasks}`,
      latestScore: latest?.score ?? null,
      attentionScore,
    },
    attentionReasons,
    weeklyTests: weeklyTests.map((t) => {
      let replies = 0;
      try {
        const conv = JSON.parse(t.conversation) as Array<{ role?: string }>;
        replies = conv.filter((m) => m.role === "student").length;
      } catch {
        replies = 0;
      }
      let strengths: string[] = [];
      let weaknesses: string[] = [];
      try { strengths = JSON.parse(t.strengths); } catch { strengths = []; }
      try { weaknesses = JSON.parse(t.weaknesses); } catch { weaknesses = []; }
      return {
        week: t.week,
        score: t.score,
        status: t.status,
        completedAt: t.completedAt?.toISOString() ?? null,
        plagiarismScore: t.plagiarismScore,
        strengths,
        weaknesses,
        nextAction: t.nextAction,
        retakeAllowed: t.retakeAllowed,
        replies,
      };
    }),
    reportCards: reportCards.map((r) => ({
      id: r.id,
      week: r.week ?? null,
      score: r.score,
      grade: r.grade,
      createdAt: r.date.toISOString(),
    })),
    competencies: competencies.map((c) => ({ topic: c.topic, level: c.masteryLevel })),
    dailyLogs: dailyLogs.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      confidence: null,
    })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.description, status: t.status, week: t.week })),
    projects: projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "completed").length;
      let objectives: string[] = [];
      try {
        const parsed = JSON.parse(p.objectives ?? "[]");
        objectives = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        objectives = [];
      }
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        description: p.description,
        objectives,
        durationWeeks: p.durationWeeks,
        status: p.status,
        approvalNote: p.approvalNote,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        deadline: p.deadline?.toISOString() ?? null,
        updatedAt: p.updatedAt.toISOString(),
        kpis: {
          taskProgress: total > 0 ? Math.round((done / total) * 100) : 0,
          tasksDone: `${done}/${total}`,
        },
      };
    }),
    certificates: certificates.map((c) => ({
      id: c.id,
      courseName: c.courseName,
      grade: c.grade,
      score: c.score,
      issuedAt: c.issuedAt.toISOString(),
      verifyUrl: `/verify/${c.verifyToken}`,
    })),
    recentEvents: events.map((e) => ({
      type: e.eventType,
      at: e.createdAt.toISOString(),
    })),
    psychWeekly: null,
  });
}
