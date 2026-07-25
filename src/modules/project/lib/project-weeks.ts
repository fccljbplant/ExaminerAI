/**
 * Project Weeks — weekly plan management.
 *
 * Extracted from src/app/api/project/weeks/route.ts.
 *
 * Schema (ProjectWeek model):
 *   - weekNumber  Int       (NOT "week")
 *   - title       String
 *   - summary     String    @default("") — required, never null
 *   - milestones  String    @default("[]") — JSON array (NOT singular "milestone")
 */

import { db } from "@/lib/db";

/** Get all project weeks for a student. */
export async function getProjectWeeks(userId: string) {
  return db.projectWeek.findMany({
    where: { userId },
    orderBy: { weekNumber: "asc" },
  });
}

/** Update a project week (title, summary, milestones). */
export async function updateProjectWeek(weekId: string, userId: string, data: {
  title?: string;
  summary?: string;
  milestone?: string | null;
}) {
  const existing = await db.projectWeek.findUnique({ where: { id: weekId } });
  if (!existing || existing.userId !== userId) {
    return { ok: false, error: "Week not found" };
  }

  // Convert single milestone string → JSON array for the `milestones` field
  let milestonesJson: string | undefined;
  if (data.milestone !== undefined) {
    const arr = data.milestone ? [data.milestone] : [];
    milestonesJson = JSON.stringify(arr);
  }

  const updated = await db.projectWeek.update({
    where: { id: weekId },
    data: {
      ...(data.title !== undefined && { title: data.title.slice(0, 200) }),
      ...(data.summary !== undefined && { summary: data.summary.slice(0, 500) }),
      ...(milestonesJson !== undefined && { milestones: milestonesJson }),
    },
  });
  return { ok: true, week: updated };
}
