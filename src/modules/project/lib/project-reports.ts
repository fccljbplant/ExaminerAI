/**
 * Project Reports — submission and management.
 *
 * Extracted from src/app/api/project/reports/route.ts.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Get all project reports for a student. */
export async function getProjectReports(userId: string) {
  return db.projectReport.findMany({
    where: { userId },
    orderBy: { week: "asc" },
  });
}

/** Submit a project report. */
export async function submitProjectReport(userId: string, week: number, reportType: string, reportText: string) {
  return db.projectReport.create({
    data: { userId, week, reportType, reportText },
  });
}

/** Delete a project report. Only by the owner. */
export async function deleteProjectReport(reportId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const report = await db.projectReport.findUnique({ where: { id: reportId } });
    if (!report) return { ok: false, error: "Report not found" };
    if (report.userId !== userId) return { ok: false, error: "Not your report" };
    await db.projectReport.delete({ where: { id: reportId } });
    return { ok: true };
  } catch (err) {
    if ((err as any)?.code === "P2025") return { ok: false, error: "Report not found" };
    logger.error("Failed to delete report", { reportId, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Failed to delete report" };
  }
}
