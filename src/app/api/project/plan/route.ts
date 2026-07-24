import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/project/plan — returns the student's PROJECT plan (NOT curriculum).
 *
 *  Returns:
 *  - Project definition: name, scope, objectives, requirements, business case,
 *    durationWeeks, startDate, notes, githubUrl, deployUrl
 *  - tasksByWeek: { 1: [{ id, description, status, dueDate, estimatedMinutes, isMilestone, taskNotes }], ... }
 *  - progressByWeek: { 1: { completed, total, percent }, ... }
 *  - overallProgress: number (0-100)
 *  - currentWeek: number
 *
 *  NOTE: This endpoint is project-only. The curriculum (weekly learning topics)
 *  is fixed in src/lib/course-topics.ts and is served separately via
 *  /api/curriculum/progress.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fullUser, tasks] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        projectName: true,
        projectScope: true,
        projectObjectives: true,
        projectRequirements: true,
        projectBusinessCase: true,
        projectDurationWeeks: true,
        projectStartDate: true,
        projectNotes: true,
        projectGithubUrl: true,
        projectDeployUrl: true,
        currentWeek: true,
      },
    }),
    db.projectTask.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, description: true, status: true, week: true, dueDate: true,
        estimatedMinutes: true, isMilestone: true, taskNotes: true,
      },
    }),
  ]);

  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const durationWeeks = fullUser.projectDurationWeeks ?? 6;

  // Group tasks by week
  const tasksByWeek: Record<number, typeof tasks> = {};
  for (const t of tasks) {
    if (!tasksByWeek[t.week]) tasksByWeek[t.week] = [];
    tasksByWeek[t.week].push(t);
  }

  // Progress per week (from 1 to durationWeeks, but include extra weeks if student has tasks beyond)
  const maxWeek = Math.max(durationWeeks, ...tasks.map(t => t.week), 1);
  const progressByWeek: Record<number, { completed: number; total: number; percent: number }> = {};
  for (let w = 1; w <= maxWeek; w++) {
    const weekTasks = tasksByWeek[w] || [];
    const completed = weekTasks.filter(t => t.status === "completed").length;
    const total = weekTasks.length;
    progressByWeek[w] = {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  // Overall progress
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Build a structured plan array for the UI (1..durationWeeks)
  const plan = Array.from({ length: durationWeeks }, (_, i) => i + 1).map(w => ({
    week: w,
    tasks: (tasksByWeek[w] || []).map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      isMilestone: t.isMilestone,
      taskNotes: t.taskNotes,
    })),
    progress: progressByWeek[w],
    isCurrent: w === fullUser.currentWeek,
    isPast: w < fullUser.currentWeek,
  }));

  // Also include extra weeks beyond durationWeeks if student added tasks there
  for (let w = durationWeeks + 1; w <= maxWeek; w++) {
    if (tasksByWeek[w] && tasksByWeek[w].length > 0) {
      plan.push({
        week: w,
        tasks: (tasksByWeek[w] || []).map(t => ({
          id: t.id, description: t.description, status: t.status, dueDate: t.dueDate,
          estimatedMinutes: t.estimatedMinutes, isMilestone: t.isMilestone, taskNotes: t.taskNotes,
        })),
        progress: progressByWeek[w],
        isCurrent: w === fullUser.currentWeek,
        isPast: w < fullUser.currentWeek,
      });
    }
  }

  return NextResponse.json({
    projectName: fullUser.projectName,
    projectScope: fullUser.projectScope,
    projectObjectives: fullUser.projectObjectives,
    projectRequirements: fullUser.projectRequirements,
    projectBusinessCase: fullUser.projectBusinessCase,
    projectDurationWeeks: durationWeeks,
    projectStartDate: fullUser.projectStartDate,
    projectNotes: fullUser.projectNotes,
    projectGithubUrl: fullUser.projectGithubUrl,
    projectDeployUrl: fullUser.projectDeployUrl,
    plan,
    currentWeek: fullUser.currentWeek,
    overallProgress,
    totalTasks,
    completedTasks,
  });
}
