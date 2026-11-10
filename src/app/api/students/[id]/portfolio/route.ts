import { isStaffRole, normalizeRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getAuthorizedStudentCourseIds } from "@/modules/instructor-portal/student-detail-visibility";

/** GET /api/students/[id]/portfolio — full student portfolio for teachers/admins.
 *
 *  Returns academic portfolio data within the caller's authorised course scope.
 *  Learner support reflections and confidence remain default-off for staff.
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

  // Keep the existing role, tenant, grant and learner-target authorisation.
  // The course intersection below narrows the response after this check.
  try {
    await assertCanAccessStudent(payload, id, "portfolio");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) || "Access denied" },
      { status: 403 },
    );
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
      projectDurationWeeks: true,
    },
  });

  if (!student || normalizeRole(student.role) !== UserRole.LEARNER) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Resolve the caller's authorised courses using the same tenant boundaries
  // as assertCanAccessStudent and the v2 instructor student-detail route.
  const callerRole = normalizeRole(payload.role);
  const learnerEnrollments = await db.courseEnrollment.findMany({
    where: { userId: id, role: "student" },
    select: { courseId: true },
  });
  const learnerCourseIds = learnerEnrollments.map((enrollment) => enrollment.courseId);
  let staffCourseIds: string[] = [];
  let grantDataScope: string | null = null;
  let hasDirectCourseAccess = false;

  if (callerRole === UserRole.INSTRUCTOR) {
    const teachingEnrollments = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    staffCourseIds = teachingEnrollments.map((enrollment) => enrollment.courseId);
    hasDirectCourseAccess =
      getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds).length > 0;

    // A student-level explicit grant remains the fallback when no shared
    // teaching course exists. It cannot widen an existing course assignment.
    if (getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds).length === 0) {
      const grant = await db.accessGrant.findFirst({
        where: {
          granteeUserId: payload.sub,
          scopeType: "student",
          scopeId: id,
          dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },
          revokedAt: null,
        },
        select: { id: true, dataScope: true },
      });
      if (grant) {
        staffCourseIds = learnerCourseIds;
        grantDataScope = grant.dataScope;
      }
    }
  } else if (callerRole === UserRole.ORG_ADMIN) {
    const adminMemberships = await db.orgMember.findMany({
      where: { userId: payload.sub, role: "admin", status: "active" },
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
        staffCourseIds = orgCourses.map((course) => course.courseId);
        hasDirectCourseAccess =
          getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds).length > 0;
      }
    }
  } else if (callerRole === UserRole.PLATFORM_ADMIN) {
    // Platform admins retain global operational access, bounded to this
    // learner's actual course enrolments.
    staffCourseIds = learnerCourseIds;
    hasDirectCourseAccess = true;
  } else {
    // Demo/legacy staff roles require the explicit student grant checked by
    // assertCanAccessStudent. Grants are student-scoped, not course-scoped.
    const grant = await db.accessGrant.findFirst({
      where: {
        granteeUserId: payload.sub,
        scopeType: "student",
        scopeId: id,
        dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },
        revokedAt: null,
      },
      select: { id: true, dataScope: true },
    });
    if (grant) {
      staffCourseIds = learnerCourseIds;
      grantDataScope = grant.dataScope;
    }
  }

  const canSeeContent =
    hasDirectCourseAccess || grantDataScope === "full" || grantDataScope === "content_only";
  const authorizedCourseIds = canSeeContent
    ? getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds)
    : [];
  const canSeeComments = callerRole === UserRole.INSTRUCTOR && canSeeContent;

  // All course-bearing records are filtered to the exact staff/learner
  // intersection. Empty intersections intentionally return no course records.
  const [tasks, dailyLogs, interactions, weeklyTests, competencies, reportCards] =
    await Promise.all([
      db.projectTask.findMany({
        where: { userId: id, courseId: { in: authorizedCourseIds } },
        orderBy: { week: "asc" },
      }),
      db.dailyLog.findMany({
        where: { userId: id, courseId: { in: authorizedCourseIds } },
        orderBy: { date: "desc" },
        take: 10,
        // Keep the relation key only to scope comments; never return it.
        select: { id: true, date: true },
      }),
      db.interaction.findMany({
        where: { userId: id, courseId: { in: authorizedCourseIds } },
        orderBy: { date: "desc" },
        take: 15,
      }),
      db.weeklyTest.findMany({
        where: { userId: id, courseId: { in: authorizedCourseIds } },
        orderBy: [{ courseId: "asc" }, { week: "asc" }, { attempt: "asc" }],
        select: {
          id: true,
          courseId: true,
          week: true,
          attempt: true,
          status: true,
          score: true,
          originalScore: true,
          scoreEditedAt: true,
          scoreEditedByRole: true,
          scoreEditReason: true,
          completedAt: true,
          retakeAllowed: true,
          plagiarismScore: true,
          weaknesses: true,
          conversation: true,
        },
      }),
      db.competency.findMany({
        where: { userId: id },
        orderBy: { score: "asc" },
      }),
      db.reportCard.findMany({
        where: { userId: id, courseId: { in: authorizedCourseIds } },
        orderBy: [{ courseId: "asc" }, { week: "asc" }],
        include: {
          versions: {
            orderBy: { version: "asc" },
            select: { version: true, grade: true, score: true, actorRole: true, reason: true, createdAt: true },
          },
        },
      }),
    ]);

  // Comments have no courseId of their own. Scope them through the course-
  // attributed records they annotate; omit unlinked comments rather than
  // exposing feedback from an unknown course.
  const commentRelations = [
    ...(tasks.length ? [{ taskId: { in: tasks.map((task) => task.id) } }] : []),
    ...(interactions.length
      ? [{ interactionId: { in: interactions.map((interaction) => interaction.id) } }]
      : []),
    ...(weeklyTests.length
      ? [{ weeklyTestId: { in: weeklyTests.map((test) => test.id) } }]
      : []),
    ...(dailyLogs.length ? [{ dailyLogId: { in: dailyLogs.map((log) => log.id) } }] : []),
  ];
  const commentLinkConstraints = [
    { OR: [{ taskId: null }, ...(tasks.length ? [{ taskId: { in: tasks.map((task) => task.id) } }] : [])] },
    { OR: [{ interactionId: null }, ...(interactions.length ? [{ interactionId: { in: interactions.map((interaction) => interaction.id) } }] : [])] },
    { OR: [{ weeklyTestId: null }, ...(weeklyTests.length ? [{ weeklyTestId: { in: weeklyTests.map((test) => test.id) } }] : [])] },
    { OR: [{ dailyLogId: null }, ...(dailyLogs.length ? [{ dailyLogId: { in: dailyLogs.map((log) => log.id) } }] : [])] },
  ];
  const comments =
    canSeeComments && commentRelations.length > 0
      ? await db.comment.findMany({
          where: { studentId: id, AND: commentLinkConstraints, OR: commentRelations },
          orderBy: { createdAt: "desc" },
          include: { instructor: { select: { name: true, email: true } } },
        })
      : [];

  // Apply the grant boundary again at the response layer as defence in depth.
  const visibleTasks = canSeeContent ? tasks : [];
  const visibleInteractions = canSeeContent ? interactions : [];
  const visibleWeeklyTests = canSeeContent ? weeklyTests : [];
  const visibleReportCards = canSeeContent ? reportCards : [];
  const visibleCompetencies = canSeeContent ? competencies : [];

  // Compute project progress only from tasks in the authorised course scope.
  const totalTasks = visibleTasks.length;
  const completedTasks = visibleTasks.filter((task) => task.status === "completed").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasProject = totalTasks > 0;

  return NextResponse.json({
    student,
    hasProject,
    progress,
    taskSummary: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: visibleTasks.filter((task) => task.status === "in-progress").length,
      planned: visibleTasks.filter((task) => task.status === "planned").length,
      blocked: visibleTasks.filter((task) => task.status === "blocked").length,
    },
    tasks: visibleTasks,
    // Daily-log dates are used only to scope instructor comments. Do not return
    // learner support reflections, confidence or check-in content to staff.
    dailyLogs: [],
    interactions,
    comments: canSeeComments ? comments : [],
    weeklyTests,
    competencies: canSeeContent ? competencies : [],
    reportCards: canSeeContent ? reportCards : [],
    dataScope: canSeeContent ? "content_only" : grantDataScope,
  });
}
