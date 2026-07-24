/**
 * Task Generator — AI-powered task generation for student projects.
 *
 * Extracted from src/app/api/project/generate-tasks/route.ts so
 * the generation logic is reusable and testable.
 */

import { db } from "@/lib/db";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";

/** Generate tasks for a student's project using AI. */
export async function generateTasks(userId: string, options: {
  weeks: number;
  tasksPerWeek: number;
  replace: boolean;
}): Promise<{ created: number; weekPlanCreated: number; error?: string }> {
  const { weeks, tasksPerWeek, replace } = options;

  // Fetch student project data
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, projectName: true, projectDescription: true, projectType: true,
      projectScope: true, projectObjectives: true, projectRequirements: true,
      projectBusinessCase: true, projectDurationWeeks: true, projectStartDate: true,
      projectNotes: true,
    },
  });
  if (!user) return { created: 0, weekPlanCreated: 0, error: "User not found" };
  if (!user.projectName) return { created: 0, weekPlanCreated: 0, error: "No project set up yet" };

  // Check for existing tasks (if not replacing)
  let oldTaskIds: string[] = [];
  if (replace) {
    const existingTasks = await db.projectTask.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    oldTaskIds = existingTasks.map(t => t.id);
  } else {
    const existingCount = await db.projectTask.count({ where: { userId: user.id } });
    if (existingCount > 0) {
      return { created: 0, weekPlanCreated: 0, error: "Tasks already exist. Use replace=true to regenerate." };
    }
  }

  // Build AI prompt
  const prompt = `Generate ${weeks} weeks × ${tasksPerWeek} tasks per week for this project:

Project: ${user.projectName}
Description: ${user.projectDescription || "N/A"}
Type: ${user.projectType || "N/A"}
Scope: ${user.projectScope || "N/A"}
Objectives: ${user.projectObjectives || "N/A"}
Requirements: ${user.projectRequirements || "N/A"}
Business Case: ${user.projectBusinessCase || "N/A"}
Notes: ${user.projectNotes || "N/A"}

Return ONLY a JSON array of task objects:
[
  { "week": 1, "description": "Task description", "isMilestone": false, "timeEstimate": "2h" },
  ...
]
Each task should be specific and actionable. Include 1-2 milestones per week.`;

  try {
    const result = await callAI([
      { role: "system", content: "You are a project planning assistant. Generate specific, actionable project tasks as JSON only." },
      { role: "user", content: prompt },
    ], { feature: "task-gen", temperature: 0.5, maxTokens: TOKEN_BUDGET.FINAL_ANALYSIS });

    const match = result.text?.match(/\[[\s\S]*\]/);
    if (!match) {
      return { created: 0, weekPlanCreated: 0, error: "AI did not return valid task data" };
    }

    let tasks: Array<{ week: number; description: string; isMilestone: boolean; timeEstimate: string }>;
    try {
      tasks = JSON.parse(match[0]);
    } catch {
      return { created: 0, weekPlanCreated: 0, error: "Failed to parse AI response" };
    }

    if (tasks.length < 5) {
      return { created: 0, weekPlanCreated: 0, error: "AI generated too few tasks. Try again." };
    }

    // Sanitize
    const sanitized = tasks
      .filter(t => t.description && typeof t.description === "string")
      .map(t => ({
        userId: user.id,
        description: String(t.description).slice(0, 500),
        status: "planned" as const,
        week: Math.min(Math.max(Number(t.week) || 1, 1), weeks),
        isMilestone: Boolean(t.isMilestone),
        timeEstimate: t.timeEstimate ? String(t.timeEstimate).slice(0, 50) : null,
      }));

    // Delete old tasks (if replace mode) AFTER AI succeeds
    if (replace && oldTaskIds.length > 0) {
      await db.comment.deleteMany({ where: { taskId: { in: oldTaskIds } } });
      await db.projectTask.deleteMany({ where: { userId: user.id } });
    }

    // Create new tasks
    const created = await db.projectTask.createMany({
      data: sanitized.map(t => ({
        userId: t.userId,
        description: t.description,
        status: t.status,
        week: t.week,
        isMilestone: t.isMilestone,
        timeEstimate: t.timeEstimate,
      })),
    });

    return { created: created.count, weekPlanCreated: 0 };
  } catch (err) {
    logger.error("Task generation failed", { userId, error: err instanceof Error ? err.message : String(err) });
    return { created: 0, weekPlanCreated: 0, error: "AI task generation failed" };
  }
}

/** Generate a week-by-week plan using AI. */
export async function generateWeekPlan(userId: string, weeks: number): Promise<{ ok: boolean; error?: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { projectName: true, projectDescription: true, projectType: true, projectObjectives: true },
  });
  if (!user?.projectName) return { ok: false, error: "No project set up" };

  const prompt = `Generate a ${weeks}-week plan for this project:
Project: ${user.projectName}
Description: ${user.projectDescription || "N/A"}
Type: ${user.projectType || "N/A"}
Objectives: ${user.projectObjectives || "N/A"}

Return ONLY a JSON array of week objects:
[
  { "week": 1, "title": "Week title", "summary": "What happens this week", "milestone": "Deliverable or null" },
  ...
]`;

  try {
    const result = await callAI([
      { role: "system", content: "You are a project planning assistant. Generate a week-by-week plan as JSON only." },
      { role: "user", content: prompt },
    ], { feature: "week-plan-gen", temperature: 0.5, maxTokens: 1000 });

    const match = result.text?.match(/\[[\s\S]*\]/);
    if (!match) return { ok: false, error: "AI did not return valid data" };

    const weekPlans = JSON.parse(match[0]);
    // Delete existing weeks
    await db.projectWeek.deleteMany({ where: { userId } });
    // Create new weeks — schema uses `weekNumber` (not `week`) and `milestones` (JSON array, not singular `milestone`)
    await db.projectWeek.createMany({
      data: weekPlans.map((w: any) => ({
        userId,
        weekNumber: Number(w.week) || 1,
        title: String(w.title || `Week ${w.week}`).slice(0, 200),
        summary: String(w.summary || "").slice(0, 500),
        milestones: w.milestone ? JSON.stringify([String(w.milestone).slice(0, 200)]) : "[]",
      })),
    });

    return { ok: true };
  } catch (err) {
    logger.error("Week plan generation failed", { userId, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "AI week plan generation failed" };
  }
}
