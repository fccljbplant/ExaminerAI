import { hasRole, isStaffRole, normalizeRole, UserRole, PLATFORM_ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";

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

  // Full access is implicit only for platform admins. Instructors and org
  // admins must pass the shared course/tenant checks; other staff (including
  // demo accounts) must hold an explicit grant. Restricted grants are applied
  // to the response below rather than being treated as unrestricted access.
  let portfolioDataScope: string | null = null;
  try {
    await assertCanAccessStudent(payload, id, "portfolio");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) || "Access denied" },
      { status: 403 },
    );
  }

  if (!hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    const grant = await db.accessGrant.findFirst({
      where: {
        granteeUserId: payload.sub,
        scopeType: "student",
        scopeId: id,
        dataScope: { in: ["full", "wellbeing_only", "crisis_only", "content_only"] },
        revokedAt: null,
      },
      select: { dataScope: true },
    });
    // Organisation and platform admins receive academic/course content for
    // oversight, never individual learner-support/wellbeing data, even if a
    // broad legacy grant exists. Platform admins have no individual support
    // signal access under the product privacy boundary.
    const viewerRole = normalizeRole(payload.role);
    portfolioDataScope =
      viewerRole === UserRole.ORG_ADMIN || viewerRole === UserRole.PLATFORM_ADMIN
        ? "content_only"
        : grant?.dataScope ?? null;
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
  const canSeeComments = !portfolioDataScope || portfolioDataScope === "full";

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
    comments: canSeeComments ? comments : [],
    weeklyTests: canSeeContent ? weeklyTests : [],
    competencies: canSeeContent ? competencies : [],
    reportCards: canSeeContent ? reportCards : [],
    dataScope: portfolioDataScope,  // so the client knows what was filtered
  });
}
