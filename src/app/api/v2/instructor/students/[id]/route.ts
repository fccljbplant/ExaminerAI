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
 * IDOR guard: instructors must teach the learner; org admins must share an
 * active organisation membership with the learner and an organisation-linked course.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { normalizeRole, UserRole } from "@/lib/rbac";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";
import { computePsychWeekly } from "@/modules/learn/lib/psych-weekly";
import { getTestConfig } from "@/modules/course/lib/course-config";
import {
  calculateAttentionScore,
  calculateTaskProgress,
  canViewLearnerSupportSignals,
  getAuthorizedStudentCourseIds,
  toDailyLogPayload,
  resolveAuthorizedCourseSelection,
} from "@/modules/instructor-portal/student-detail-visibility";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { id } = await params;

  // Student exists?
  const student = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, lastLogin: true, createdAt: true },
  });
  if (!student || normalizeRole(student.role) !== UserRole.LEARNER) {
    return apiError("Student not found", "NOT_FOUND", 404);
  }

  // IDOR: instructors are limited to courses they teach. Org admins are
  // limited to courses explicitly linked to an organisation where they and
  // the learner both hold active memberships.
  const isOrgAdmin = user.role === "org_admin";
  const includeSupportSignals = canViewLearnerSupportSignals(user.role);
  let courseIds: string[] = [];

  if (isOrgAdmin) {
    const adminMemberships = await db.orgMember.findMany({
      where: { userId: user.sub, role: "admin", status: "active" },
      select: { orgId: true },
    });
    const adminOrgIds = adminMemberships.map((membership) => membership.orgId);
    if (adminOrgIds.length > 0) {
      const learnerMemberships = await db.orgMember.findMany({
        where: { userId: id, orgId: { in: adminOrgIds }, status: "active" },
        select: { orgId: true },
      });
      const sharedOrgIds = learnerMemberships.map((membership) => membership.orgId);
      if (sharedOrgIds.length > 0) {
        const orgCourses = await db.orgCourse.findMany({
          where: { orgId: { in: sharedOrgIds } },
          select: { courseId: true },
        });
        courseIds = [...new Set(orgCourses.map((course) => course.courseId))];
      }
    }
  } else {
    const teaching = await db.courseEnrollment.findMany({
      where: { userId: user.sub, role: "instructor" },
      select: { courseId: true },
    });
    courseIds = teaching.map((teachingCourse) => teachingCourse.courseId);
  }

  // Intersect staff-authorised courses with the learner's course enrolments.
  // A selected course is required before any course-bearing records are read.
  const learnerEnrollments = courseIds.length
    ? await db.courseEnrollment.findMany({
        where: { userId: id, role: "student", courseId: { in: courseIds } },
        select: { courseId: true },
      })
    : [];
  courseIds = getAuthorizedStudentCourseIds(
    courseIds,
    learnerEnrollments.map((enrollment) => enrollment.courseId),
  );

  const courses = courseIds.length
    ? await db.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const requestedCourseId = req.nextUrl.searchParams.get("courseId");
  const courseSelection = resolveAuthorizedCourseSelection(
    courses.map((course) => course.id),
    requestedCourseId,
  );

  if (courseSelection.kind === "none" || courseSelection.kind === "forbidden") {
    return apiError(
      isOrgAdmin ? "You cannot access this learner in your organisation" : "You do not teach this student",
      "FORBIDDEN",
      403,
    );
  }

  // Multiple shared courses are not aggregated. Return only the authorised
  // course choices until the instructor explicitly selects one.
  if (courseSelection.kind === "selection_required") {
    return apiSuccess({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        lastLogin: student.lastLogin?.toISOString() ?? null,
        joinedAt: student.createdAt.toISOString(),
      },
      courses,
      courseSelectionRequired: true as const,
    });
  }

  const selectedCourseId = courseSelection.courseId;

  const [weeklyTests, reportCards, competencies, dailyLogs, tasks, certificates, events, projects, psychWeekly] =
    await Promise.all([
      db.weeklyTest.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: [{ week: "asc" }, { attempt: "asc" }],
        select: {
          week: true,
          attempt: true,
          score: true,
          originalScore: true,
          scoreEditedAt: true,
          scoreEditedByRole: true,
          scoreEditReason: true,
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
        where: { userId: id, courseId: selectedCourseId },
        orderBy: { date: "desc" },
        take: 10,
        include: {
          versions: {
            orderBy: { version: "asc" },
            select: { version: true, grade: true, score: true, actorRole: true, source: true, reason: true, createdAt: true },
          },
        },
      }),
      db.skillMastery.findMany({
        where: { userId: id },
        select: { topic: true, masteryLevel: true },
        orderBy: { topic: "asc" },
      }),
      db.dailyLog.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: { date: "desc" },
        take: 14,
        select: includeSupportSignals ? { date: true, confidence: true } : { date: true },
      }),
      db.projectTask.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: [{ week: "asc" }, { createdAt: "asc" }],
        select: { id: true, description: true, status: true, week: true },
      }),
      db.certificate.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: { issuedAt: "desc" },
        select: { id: true, courseName: true, grade: true, score: true, issuedAt: true, verifyToken: true },
      }),
      db.engagementEvent.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { eventType: true, createdAt: true },
      }),
      db.learnProject.findMany({
        where: { userId: id, courseId: selectedCourseId },
        orderBy: { updatedAt: "desc" },
        include: { tasks: { select: { id: true, status: true } } },
      }),
      includeSupportSignals
        ? computePsychWeekly(id, selectedCourseId).catch(() => null)
        : Promise.resolve(null),
    ]);

  // Use one completed attempt per week for course-level KPIs, according
  // to the selected course's published retake policy. The full attempt list
  // remains available below for transparent review.
  const testConfig = await getTestConfig(id, selectedCourseId);
  const attemptsByWeek = new Map<number, typeof weeklyTests>();
  for (const test of weeklyTests) {
    if (test.status !== "completed" || test.score === null) continue;
    const attempts = attemptsByWeek.get(test.week) ?? [];
    attempts.push(test);
    attemptsByWeek.set(test.week, attempts);
  }
  const selectedAttempts = [...attemptsByWeek.values()].map((attempts) => {
    attempts.sort((a, b) => a.attempt - b.attempt);
    if (testConfig.retakePolicy === "first") return attempts[0];
    if (testConfig.retakePolicy === "latest") return attempts[attempts.length - 1];
    return [...attempts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.attempt - a.attempt)[0];
  }).sort((a, b) => a.week - b.week);

  // Academic attention signals are unavailable until at least one source
  // (activity date or scored test) exists; an evidence-backed score of zero
  // remains distinct from missing evidence.
  const scored = selectedAttempts.map((test) => test.score as number);
  const latest = scored.length ? scored[scored.length - 1] : null;
  const attention = calculateAttentionScore(
    dailyLogs[0]?.date ?? null,
    scored,
    new Date(),
  );
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;

  return apiSuccess({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      lastLogin: student.lastLogin?.toISOString() ?? null,
      joinedAt: student.createdAt.toISOString(),
    },
    courseId: selectedCourseId,
    courses,
    kpis: {
      progress: calculateTaskProgress(totalTasks, completedTasks),
      tasksDone: `${completedTasks}/${totalTasks}`,
      latestScore: latest,
      attentionScore: attention.score,
    },
    attentionReasons: attention.reasons,
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
        attempt: t.attempt,
        score: t.score,
        originalScore: t.originalScore,
        scoreEditedAt: t.scoreEditedAt?.toISOString() ?? null,
        scoreEditedByRole: t.scoreEditedByRole,
        scoreEditReason: t.scoreEditReason,
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
      version: r.version,
      createdAt: r.date.toISOString(),
      versions: r.versions.map((version) => ({
        version: version.version,
        grade: version.grade,
        score: version.score,
        actorRole: version.actorRole,
        source: version.source,
        reason: version.reason,
        createdAt: version.createdAt.toISOString(),
      })),
    })),
    competencies: competencies.map((c) => ({ topic: c.topic, level: c.masteryLevel })),
    dailyLogs: dailyLogs.map((log) => toDailyLogPayload(log, includeSupportSignals)),
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
          taskProgress: calculateTaskProgress(total, done),
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
    psychWeekly: psychWeekly
      ? {
          weeks: psychWeekly.weeks.map((w) => ({
            weekLabel: w.weekLabel,
            confidencePct: w.confidencePct,
            actualPct: w.actualPct,
            gap: w.gap,
            coherence: w.coherence,
            days: w.days,
          })),
          avgCoherence: psychWeekly.avgCoherence,
          calibration: psychWeekly.calibration,
        }
      : null,
  });
}
