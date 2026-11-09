import { isStaffRole, normalizeRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { getAuthorizedStudentCourseIds } from "@/modules/instructor-portal/student-detail-visibility";

/** GET /api/students/[id]/portfolio — full student portfolio for teachers/admins.
 *
 *  Returns the student's project tasks, recent daily logs, recent AI
 *  interactions, bugs, and existing instructor comments. This is what the
 *  teacher sees when they click into a student from the batch dashboard.
 *
 *  Admins do not receive learner support reflections through this endpoint.
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

  // Instructors and org admins must pass course/tenant checks; platform
  // admins have global operational access; other staff need an explicit grant.
  // Regardless of access role, the staff response is clamped to academic data
  // until per-organisation support consent and feature gates are implemented.
  let portfolioDataScope: string | null = null;
  try {
    await assertCanAccessStudent(payload, id, "portfolio");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) || "Access denied" },
      { status: 403 },
    );
  }

  // Support reflections, confidence and wellbeing are default-off for
  // every staff audience until the per-org consent and feature gate exist.
  // Access grants do not activate the feature by themselves.
  portfolioDataScope = "content_only";

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

  // Resolve the exact course boundary after the general student access check.\n  // Instructors see courses they teach; org admins see courses linked to a\n  // shared active organisation; platform admins and explicit student grants\n  // retain their existing student-wide operational scope, limited to the\n  // learner's enrolled courses.\n  const callerRole = normalizeRole(payload.role);\n  const learnerEnrollments = await db.courseEnrollment.findMany({\n    where: { userId: id, role: "student" },\n    select: { courseId: true },\n  });\n  const learnerCourseIds = learnerEnrollments.map((enrollment) => enrollment.courseId);\n  let staffCourseIds: string[] = [];\n\n  if (callerRole === UserRole.INSTRUCTOR) {\n    const teachingEnrollments = await db.courseEnrollment.findMany({\n      where: { userId: payload.sub, role: "instructor" },\n      select: { courseId: true },\n    });\n    staffCourseIds = teachingEnrollments.map((enrollment) => enrollment.courseId);\n\n    // A student-level explicit grant is the existing fallback when an\n    // instructor does not share a teaching course with this learner.\n    if (getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds).length === 0) {\n      const grant = await db.accessGrant.findFirst({\n        where: {\n          granteeUserId: payload.sub,\n          scopeType: "student",\n          scopeId: id,\n          dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },\n          revokedAt: null,\n        },\n        select: { id: true },\n      });\n      if (grant) staffCourseIds = learnerCourseIds;\n    }\n  } else if (callerRole === UserRole.ORG_ADMIN) {\n    const adminMemberships = await db.orgMember.findMany({\n      where: { userId: payload.sub, role: "admin", status: "active" },\n      select: { orgId: true },\n    });\n    const adminOrgIds = adminMemberships.map((membership) => membership.orgId);\n    if (adminOrgIds.length > 0) {\n      const learnerMemberships = await db.orgMember.findMany({\n        where: { userId: id, orgId: { in: adminOrgIds }, status: "active" },\n        select: { orgId: true },\n      });\n      const sharedOrgIds = learnerMemberships.map((membership) => membership.orgId);\n      if (sharedOrgIds.length > 0) {\n        const orgCourses = await db.orgCourse.findMany({\n          where: { orgId: { in: sharedOrgIds } },\n          select: { courseId: true },\n        });\n        staffCourseIds = orgCourses.map((course) => course.courseId);\n      }\n    }\n  } else if (callerRole === UserRole.PLATFORM_ADMIN) {\n    staffCourseIds = learnerCourseIds;\n  } else {\n    // Demo/legacy staff roles require the same explicit student grant used by\n    // assertCanAccessStudent. Grants are student-scoped, so constrain them to\n    // the learner's actual course enrolments rather than nullable records.\n    const grant = await db.accessGrant.findFirst({\n      where: {\n        granteeUserId: payload.sub,\n        scopeType: "student",\n        scopeId: id,\n        dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },\n        revokedAt: null,\n      },\n      select: { id: true },\n    });\n    if (grant) staffCourseIds = learnerCourseIds;\n  }\n\n  const authorizedCourseIds = getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds);\n\n  // Instructors retain access to their teaching feedback. Other staff do not
  // receive private instructor comments through this endpoint.
  const canSeeComments = normalizeRole(payload.role) === UserRole.INSTRUCTOR;

  const [tasks, dailyLogs, interactions, comments, weeklyTests, competencies, reportCards] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: id, courseId: { in: authorizedCourseIds } },
      orderBy: { week: "asc" },
    }),
    db.dailyLog.findMany({
      where: { userId: id, courseId: { in: authorizedCourseIds } },
      orderBy: { date: "desc" },
      take: 10,
      // Keep the relation key only to scope instructor comments; never return it.
      select: { id: true, date: true },
    }),
    db.interaction.findMany({
      where: { userId: id, courseId: { in: authorizedCourseIds } },
      orderBy: { date: "desc" },
      take: 15,
    }),
    db.weeklyTest.findMany({
      where: { userId: id, courseId: { in: authorizedCourseIds } },
      orderBy: { week: "asc" },
      select: { id: true, week: true, status: true, score: true, completedAt: true, retakeAllowed: true, plagiarismScore: true, weaknesses: true, conversation: true },
    }),
    db.competency.findMany({
      where: { userId: id },
      orderBy: { score: "asc" },
    }),
    db.reportCard.findMany({
      where: { userId: id, courseId: { in: authorizedCourseIds } },
      orderBy: { week: "asc" },
    }),
  ]);\n\n  // Comments are course-scoped through the academic record they annotate.\n  // Unlinked comments have no reliable course attribution and are omitted.\n  const commentRelations = [\n    ...(tasks.length ? [{ taskId: { in: tasks.map((task) => task.id) } }] : []),\n    ...(interactions.length ? [{ interactionId: { in: interactions.map((interaction) => interaction.id) } }] : []),\n    ...(weeklyTests.length ? [{ weeklyTestId: { in: weeklyTests.map((test) => test.id) } }] : []),\n    ...(dailyLogs.length ? [{ dailyLogId: { in: dailyLogs.map((log) => log.id) } }] : []),\n  ];\n  const comments = canSeeComments && commentRelations.length > 0\n    ? await db.comment.findMany({\n        where: { studentId: id, OR: commentRelations },\n        orderBy: { createdAt: "desc" },\n        include: { instructor: { select: { name: true, email: true } } },\n      })\n    : [];\n\n  // Compute project progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasProject = totalTasks > 0;

  // N2-fix: filter the response based on the grant's dataScope.
  // - full: everything (default for admins + teachers in own batch)
  // - wellbeing_only: dailyLogs only (no project content)
  // - crisis_only: minimal (no project, no daily logs)
  // - content_only: tasks, report cards, interactions, weekly tests and competencies; no daily reflections
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
    dailyLogs: canSeeWellbeing ? dailyLogs.map(({ date }) => ({ date })) : [],
    interactions: canSeeContent ? interactions : [],
    // bugs: removed (Bug model deleted — feature never built out)
    comments: canSeeComments ? comments : [],
    weeklyTests: canSeeContent ? weeklyTests : [],
    competencies: canSeeContent ? competencies : [],
    reportCards: canSeeContent ? reportCards : [],
    dataScope: portfolioDataScope,  // so the client knows what was filtered
  });
}
