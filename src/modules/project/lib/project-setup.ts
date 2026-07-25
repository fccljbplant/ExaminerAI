/**
 * Project Setup — initialization, deletion, and configuration.
 *
 * Extracted from src/app/api/project/setup/route.ts and
 * src/app/api/project/plan/route.ts so the business logic is
 * reusable independent of the HTTP route.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Set up a student's project with metadata. */
export async function setupProject(userId: string, projectData: {
  projectName?: string;
  projectDescription?: string;
  projectType?: string;
  projectScope?: string;
  projectObjectives?: string;
  projectRequirements?: string;
  projectBusinessCase?: string;
  projectDurationWeeks?: number;
  projectStartDate?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        ...(projectData.projectName !== undefined && { projectName: projectData.projectName.trim() }),
        ...(projectData.projectDescription !== undefined && { projectDescription: projectData.projectDescription.trim() }),
        ...(projectData.projectType !== undefined && { projectType: projectData.projectType.trim() }),
        ...(projectData.projectScope !== undefined && { projectScope: projectData.projectScope.trim() }),
        ...(projectData.projectObjectives !== undefined && { projectObjectives: projectData.projectObjectives.trim() }),
        ...(projectData.projectRequirements !== undefined && { projectRequirements: projectData.projectRequirements.trim() }),
        ...(projectData.projectBusinessCase !== undefined && { projectBusinessCase: projectData.projectBusinessCase.trim() }),
        ...(projectData.projectDurationWeeks !== undefined && { projectDurationWeeks: projectData.projectDurationWeeks }),
        ...(projectData.projectStartDate !== undefined && { projectStartDate: projectData.projectStartDate ? new Date(projectData.projectStartDate) : null }),
      },
    });
    return { ok: true };
  } catch (err) {
    logger.error("Project setup failed", { userId, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Failed to save project" };
  }
}

/** Delete a student's project + all related data (tasks, weeks, comments). */
export async function deleteProject(userId: string): Promise<{ ok: boolean; deletedCount: number }> {
  try {
    const taskIds = await db.projectTask.findMany({
      where: { userId },
      select: { id: true },
    });

    await db.$transaction(async (tx) => {
      if (taskIds.length > 0) {
        await tx.comment.deleteMany({
          where: { taskId: { in: taskIds.map(t => t.id) } },
        });
        await tx.projectTask.deleteMany({ where: { userId } });
        await tx.projectWeek.deleteMany({ where: { userId } });
        await tx.user.update({
          where: { id: userId },
          data: {
            projectName: null,
            projectDescription: null,
            projectType: null,
            projectScope: null,
            projectObjectives: null,
            projectRequirements: null,
            projectBusinessCase: null,
            projectSummary: null,
            projectKeyFeatures: null,
            projectDurationWeeks: null,
            projectStartDate: null,
            projectNotes: null,
            projectGithubUrl: null,
            projectDeployUrl: null,
          },
        });
      }
    });

    return { ok: true, deletedCount: taskIds.length };
  } catch (err) {
    logger.error("Project deletion failed", { userId, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, deletedCount: 0 };
  }
}

/** Get a student's project plan (metadata only, not tasks). */
export async function getProjectPlan(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      projectName: true,
      projectDescription: true,
      projectType: true,
      projectScope: true,
      projectObjectives: true,
      projectRequirements: true,
      projectBusinessCase: true,
      projectSummary: true,
      projectKeyFeatures: true,
      projectDurationWeeks: true,
      projectStartDate: true,
      projectNotes: true,
      projectGithubUrl: true,
      projectDeployUrl: true,
    },
  });
  return user;
}

/** Update a student's project plan. */
export async function updateProjectPlan(userId: string, planData: Record<string, unknown>): Promise<{ ok: boolean }> {
  try {
    const allowedFields = [
      "projectName", "projectDescription", "projectType", "projectScope",
      "projectObjectives", "projectRequirements", "projectBusinessCase",
      "projectDurationWeeks", "projectStartDate", "projectNotes",
      "projectGithubUrl", "projectDeployUrl",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in planData) {
        updateData[field] = planData[field];
      }
    }
    if (Object.keys(updateData).length === 0) return { ok: true };
    await db.user.update({ where: { id: userId }, data: updateData });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
