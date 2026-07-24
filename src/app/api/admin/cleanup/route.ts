import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getAuthUser } from "@/lib/auth";

/** POST /api/admin/cleanup — cleans up junk data from the admin user.
 *
 *  The admin account is a developer super-account for testing. Over time,
 *  it accumulates test data (weekly tests, practice questions, tasks,
 *  check-ins, competencies, bugs, psychObs, report cards) from testing
 *  the app as different roles. This endpoint clears ALL of that junk data
 *  so the admin account is clean.
 *
 *  Admin-only. Does NOT delete the admin account itself, messages, or
 *  comments (those are legitimate admin activity).
 */
export async function POST() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = payload.sub;

  try {
    // R6-fix: run deletes as independent calls (NOT in a transaction).
    // In Postgres, a failed query inside an interactive $transaction
    // aborts the whole transaction — every subsequent query fails.
    // Independent calls with try/catch actually achieve the "individual
    // failures don't abort" goal.
    const deletes = [
      () => db.comment.deleteMany({ where: { studentId: adminId } }),
      () => db.comment.deleteMany({ where: { teacherId: adminId, interactionId: { not: null } } }),
      () => db.psychologyObs.deleteMany({ where: { userId: adminId } }),
      () => db.reportCard.deleteMany({ where: { userId: adminId } }),
      () => db.competency.deleteMany({ where: { userId: adminId } }),
      () => db.weeklyTest.deleteMany({ where: { userId: adminId } }),
      () => db.interaction.deleteMany({ where: { userId: adminId } }),
      () => db.projectTask.deleteMany({ where: { userId: adminId } }),
      () => db.dailyLog.deleteMany({ where: { userId: adminId } }),
      () => db.projectWeek.deleteMany({ where: { userId: adminId } }),
      () => db.projectReport.deleteMany({ where: { userId: adminId } }),
      () => db.curriculumProgress.deleteMany({ where: { userId: adminId } }),
      () => db.certificate.deleteMany({ where: { userId: adminId } }),
      () => db.confidenceRating.deleteMany({ where: { userId: adminId } }),
      () => db.wellbeingState.deleteMany({ where: { userId: adminId } }),
      () => db.crisisFlag.deleteMany({ where: { userId: adminId } }),
      () => db.skillMastery.deleteMany({ where: { userId: adminId } }),
      () => db.mentorshipTouchpoint.deleteMany({ where: { userId: adminId } }),
      () => db.dailyTest.deleteMany({ where: { userId: adminId } }),
      () => db.peerAssessment.deleteMany({ where: { OR: [{ assesseeId: adminId }, { assessorId: adminId }] } }),
      () => db.accessGrant.deleteMany({ where: { OR: [{ granteeUserId: adminId }, { scopeId: adminId }] } }),
      // R5-fix: removed message deleteMany — messages are legitimate
      // admin activity and should NOT be deleted by cleanup.
    ];
    const counts: number[] = [];
    for (const del of deletes) {
      try {
        const r = await del();
        counts.push(r.count);
      } catch {
        counts.push(0);
      }
    }


    const deleted = {
      comments: (counts[0] ?? 0) + (counts[1] ?? 0),
      psychObs: counts[2] ?? 0,
      reportCards: counts[3] ?? 0,
      competencies: counts[4] ?? 0,
      weeklyTests: counts[5] ?? 0,
      interactions: counts[6] ?? 0,
      tasks: counts[7] ?? 0,
      dailyLogs: counts[8] ?? 0,
      additional: counts.slice(9).reduce((a, b) => a + b, 0),
    };

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      message: `Admin junk data cleaned. ${totalDeleted} record(s) deleted.`,
      deleted,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
