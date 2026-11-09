import { isStaffRole, normalizeRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";

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

  // Instructors retain access to their teaching feedback. Other staff do not
  // receive private instructor comments through this endpoint.
  const canSeeComments = normalizeRole(payload.role) === UserRole.INSTRUCTOR;

  const [tasks, dailyLogs, interactions, comments, weeklyTests, competencies, reportCards] = await Promise.all([
    db.projectTask.findMany({
      where: { userId: id },
      orderBy: { week: "asc" },
    }),
    db.dailyLog.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
      take: 10,
      // Staff portfolio support data is default-off; fetch dates only.
      select: { date: true },
    }),
    db.interaction.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
      take: 15,
    }),
    canSeeComments
      ? db.comment.findMany({
          where: { studentId: id },
          orderBy: { createdAt: "desc" },
          include: { instructor: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
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
