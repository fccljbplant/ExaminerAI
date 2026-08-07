import { hasRole, ADMIN_ROLES, isStaffRole, UserRole, normalizeRole } from "@/lib/rbac";
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

  // N2-fix: track the dataScope for response filtering.
  // null = full access (admin or teacher in own batch). Otherwise it's
  // the grant's scope (full, wellbeing_only, crisis_only, content_only).
  let portfolioDataScope: string | null = null;

  // Phase 0.4 fix: IDOR protection. Instructors can only access learners in
  // their own courses. Admins can access any learner. This prevents an
  // instructor from reading another instructor's learners' data.
  // Post-purge 2026-08: counselor/coordinator/guardian roles were removed.
  // Demo + non-staff-with-grant now need an AccessGrant — previously they
  // fell through with no check at all.
  // N5-fix: legacy teachers (null batch) now also need an AccessGrant —
  // previously they could see all students institution-wide.
  let needsGrantCheck = false;

  if (hasRole(payload.role, ADMIN_ROLES)) {
    // Admins — full access, no check needed
  } else if (normalizeRole(payload.role) === UserRole.INSTRUCTOR) {
    const studentCheck = await db.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!studentCheck || normalizeRole(studentCheck.role) !== UserRole.LEARNER) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    // Verify the instructor teaches a course the student is enrolled in
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
    const instructorCourseIds = instructorCourses.map(e => e.courseId);
    const studentCourseIds = studentCourses.map(e => e.courseId);
    const sharedCourseIds = instructorCourseIds.filter(cid => studentCourseIds.includes(cid));
    if (sharedCourseIds.length === 0) {
      needsGrantCheck = true;
    }
  } else {
    // Demo or any non-admin/non-instructor staff — need an AccessGrant
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
    // A demo with "content_only" should NOT see psychObs or crisis data.
    // A demo with "crisis_only" should NOT see project content.
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

  const [tasks, dailyLogs, interactions, comments, weeklyTests, competencies, reportCards] = await Promise.all([
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
      include: { instructor: { select: { name: true, email: true } } },
    }),
    db.weeklyTest.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
      select: { id: true, week: true, status: true, score: true, completedAt: true, retakeAllowed: true, plagiarismScore: true, weaknesses: true, conversation: true },
    }),
    db.competency.findMany({
      where: { userId: id },
      orderBy: { score: "asc" },
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

  // N2-fix: filter the response based on the grant's dataScope.
  // - full: everything (default for admins + teachers in own batch)
  // - wellbeing_only: dailyLogs only (no project content)
  // - crisis_only: minimal (no project, no daily logs)
  // - content_only: tasks + reportCards + interactions only
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
    reportCards: canSeeContent ? reportCards : [],
    dataScope: portfolioDataScope,  // so the client knows what was filtered
  });
}
