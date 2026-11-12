import { isStaffRole, UserRole, normalizeRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** GET /api/students/[id]/portfolio — full student portfolio for teachers/admins.
 *
 *  Returns the student's project tasks, recent daily logs, recent AI
 *  interactions, bugs, and existing instructor comments. This is what the
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

  // Access is role-specific: platform admins operate the platform, org admins
  // are limited to their active organisation's courses, and instructors to
  // courses they teach. Demo access always requires an explicit student grant.
  let portfolioDataScope: string | null = null;
  let scopedCourseIds: string[] | null = null;
  const role = normalizeRole(payload.role);
  const isPlatformAdmin = role === UserRole.PLATFORM_ADMIN;

  if (role === UserRole.ORG_ADMIN) {
    const memberships = await db.orgMember.findMany({
      where: { userId: payload.sub, role: "admin", status: "active" },
      select: { orgId: true },
    });
    const orgIds = memberships.map((membership) => membership.orgId);
    const orgCourses = orgIds.length
      ? await db.orgCourse.findMany({
          where: { orgId: { in: orgIds } },
          select: { courseId: true },
        })
      : [];
    const orgCourseIds = orgCourses.map((course) => course.courseId);
    const learnerCourses = orgCourseIds.length
      ? await db.courseEnrollment.findMany({
          where: { userId: id, role: "student", courseId: { in: orgCourseIds } },
          select: { courseId: true },
        })
      : [];
    scopedCourseIds = [...new Set(learnerCourses.map((course) => course.courseId))];

    if (scopedCourseIds.length === 0) {
      return NextResponse.json({ error: "You do not have access to this learner in your organisation" }, { status: 403 });
    }
  } else if (role === UserRole.INSTRUCTOR) {
    const studentCheck = await db.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!studentCheck || normalizeRole(studentCheck.role) !== UserRole.LEARNER) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const [instructorCourses, studentCourses] = await Promise.all([
      db.courseEnrollment.findMany({
        where: { userId: payload.sub, role: "instructor" },
        select: { courseId: true },
      }),
      db.courseEnrollment.findMany({
        where: { userId: id, role: "student" },
        select: { courseId: true },
      }),
    ]);
    const instructorCourseIds = new Set(instructorCourses.map((course) => course.courseId));
    scopedCourseIds = [...new Set(
      studentCourses
        .map((course) => course.courseId)
        .filter((courseId) => instructorCourseIds.has(courseId)),
    )];

    if (scopedCourseIds.length === 0) {
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
      portfolioDataScope = grant.dataScope;
      scopedCourseIds = null;
    }
  } else if (!isPlatformAdmin) {
    // Includes demo accounts. They are staff for routing purposes, not admins.
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

  if (!student || normalizeRole(student.role) !== UserRole.LEARNER) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const courseScope = scopedCourseIds !== null
    ? { courseId: { in: scopedCourseIds } }
    : {};
  const canSeeContent = !portfolioDataScope || portfolioDataScope === "full" || portfolioDataScope === "content_only";
  const canSeeFullPortfolio = !portfolioDataScope || portfolioDataScope === "full";
  const canSeeWellbeing = (!portfolioDataScope || portfolioDataScope === "full" || portfolioDataScope === "wellbeing_only")
    && !isPlatformAdmin;

  const [tasks, dailyLogs, interactions, weeklyTests, reportCards] = await Promise.all([
    canSeeContent
      ? db.projectTask.findMany({
          where: { userId: id, ...courseScope },
          orderBy: { week: "asc" },
        })
      : Promise.resolve([]),
    canSeeWellbeing
      ? db.dailyLog.findMany({
          where: { userId: id, ...courseScope },
          orderBy: { date: "desc" },
          take: 10,
          // Organisation admins need attendance dates, not private reflections,
          // confidence or wellbeing detail from learner journals.
          ...(role === UserRole.ORG_ADMIN ? { select: { date: true } } : {}),
        })
      : Promise.resolve([]),
    canSeeContent
      ? db.interaction.findMany({
          where: { userId: id, ...courseScope },
          orderBy: { date: "desc" },
          take: 15,
        })
      : Promise.resolve([]),
    canSeeFullPortfolio
      ? db.weeklyTest.findMany({
          where: { userId: id, ...courseScope },
          orderBy: { week: "asc" },
          select: { id: true, week: true, status: true, score: true, completedAt: true, retakeAllowed: true, plagiarismScore: true, weaknesses: true, conversation: true },
        })
      : Promise.resolve([]),
    canSeeContent
      ? db.reportCard.findMany({
          where: { userId: id, ...courseScope },
          orderBy: { week: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Comments are attached to a course-bearing record. When a caller is
  // course-scoped, derive comment access from those already-scoped record IDs.
  const commentRelations = scopedCourseIds === null
    ? null
    : [
        ...(tasks.length ? [{ taskId: { in: tasks.map((task) => task.id) } }] : []),
        ...(dailyLogs.length ? [{ dailyLogId: { in: dailyLogs.map((log) => log.id) } }] : []),
        ...(interactions.length ? [{ interactionId: { in: interactions.map((item) => item.id) } }] : []),
        ...(weeklyTests.length ? [{ weeklyTestId: { in: weeklyTests.map((test) => test.id) } }] : []),
      ];
  const comments = canSeeFullPortfolio && (commentRelations === null || commentRelations.length > 0)
    ? await db.comment.findMany({
        where: {
          studentId: id,
          ...(commentRelations === null ? {} : { OR: commentRelations }),
        },
        orderBy: { createdAt: "desc" },
        include: { instructor: { select: { name: true, email: true } } },
      })
    : [];

  // Competency has no courseId in the current schema. Do not expose global
  // learner-level records to a course-scoped instructor or organisation admin.
  // A platform admin or explicit whole-learner grant may still see this data.
  const competencies = canSeeFullPortfolio && scopedCourseIds === null
    ? await db.competency.findMany({
        where: { userId: id },
        orderBy: { score: "asc" },
      })
    : [];

  // Compute project progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasProject = totalTasks > 0;

  return NextResponse.json({
    student,
    hasProject: canSeeContent ? hasProject : null,
    progress: canSeeContent ? progress : null,
    // Always return empty arrays/objects (never undefined) so UI never has to null-check.
    // The `dataScope` field tells the client what was filtered out.
    taskSummary: canSeeContent ? {
      total: totalTasks,
      completed: completedTasks,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      planned: tasks.filter((t) => t.status === "planned").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    } : null,
    tasks: canSeeContent ? tasks : [],
    dailyLogs,
    interactions,
    // bugs: removed (Bug model deleted — feature never built out)
    comments,
    weeklyTests,
    competencies,
    reportCards: canSeeContent ? reportCards : [],
    dataScope: portfolioDataScope,  // so the client knows what was filtered
  });
}
