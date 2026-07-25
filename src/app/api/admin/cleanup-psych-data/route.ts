import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/admin/cleanup-psych-data — removes old junk from psychological
 *  data tables that were created by the old per-message pipeline.
 *
 *  What gets cleaned:
 *  1. ChatSession rows where chatbotType = "student_tutor" or "teacher_tutor"
 *  2. Interaction rows where pillar = "AI Tutor" or "AI Teacher"
 *  3. PsychEvidence rows where sourceId starts with "tutor-"
 *  4. ConfidenceRating rows where context starts with "tutor-"
 *  5. PsychologyObs rows (old model, replaced by PsychEvidence)
 *
 *  What is KEPT:
 *  - PsychEvidence from actual test completions
 *  - ConfidenceRating from actual tests
 *  - SkillMastery, WellbeingState, CrisisFlag
 *  - ChatSession from actual tests (practice, daily_test, weekly_test)
 *  - StudentHealthSummary
 *
 *  Admin-only (principal + administrator).
 */
export async function POST() {
  const _demoBlock = await demoWriteBlock("cleaning up data"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, number> = {};

  try {
    const r1 = await db.chatSession.deleteMany({
      where: { chatbotType: { in: ["student_tutor", "teacher_tutor"] } },
    });
    results.chatSession_tutor_snapshots = r1.count;

    const r2 = await db.interaction.deleteMany({
      where: { pillar: { in: ["AI Tutor", "AI Teacher"] } },
    });
    results.interaction_tutor_logs = r2.count;

    const r3 = await db.psychEvidence.deleteMany({
      where: { sourceId: { startsWith: "tutor-" } },
    });
    results.psychEvidence_tutor_artifacts = r3.count;

    const r4 = await db.confidenceRating.deleteMany({
      where: { source: "daily_test", context: { startsWith: "tutor-" } },
    });
    results.confidenceRating_tutor_artifacts = r4.count;

    const r5 = await db.psychologyObs.deleteMany({});
    results.psychologyObs_old_duplicates = r5.count;

    const kept = {
      psychEvidence_from_tests: await db.psychEvidence.count(),
      confidenceRating_from_tests: await db.confidenceRating.count(),
      skillMastery: await db.skillMastery.count(),
      wellbeingState: await db.wellbeingState.count(),
      crisisFlags: await db.crisisFlag.count(),
      chatSession_from_tests: await db.chatSession.count({
        where: { chatbotType: { in: ["practice", "daily_test", "weekly_test"] } },
      }),
      healthSummary: await db.studentHealthSummary.count(),
    };

    logger.info("Psych data cleanup completed", { deleted: results, kept });

    return NextResponse.json({
      ok: true,
      deleted: results,
      totalDeleted: Object.values(results).reduce((a, b) => a + b, 0),
      kept,
    });
  } catch (err) {
    logger.error("Psych data cleanup failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

/** GET /api/admin/cleanup-psych-data — dry run preview. */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preview = {
    chatSession_tutor_snapshots: await db.chatSession.count({
      where: { chatbotType: { in: ["student_tutor", "teacher_tutor"] } },
    }),
    interaction_tutor_logs: await db.interaction.count({
      where: { pillar: { in: ["AI Tutor", "AI Teacher"] } },
    }),
    psychEvidence_tutor_artifacts: await db.psychEvidence.count({
      where: { sourceId: { startsWith: "tutor-" } },
    }),
    confidenceRating_tutor_artifacts: await db.confidenceRating.count({
      where: { source: "daily_test", context: { startsWith: "tutor-" } },
    }),
    psychologyObs_old_duplicates: await db.psychologyObs.count(),
  };

  const kept = {
    psychEvidence_from_tests: await db.psychEvidence.count(),
    confidenceRating_from_tests: await db.confidenceRating.count(),
    skillMastery: await db.skillMastery.count(),
    wellbeingState: await db.wellbeingState.count(),
    crisisFlags: await db.crisisFlag.count(),
    healthSummary: await db.studentHealthSummary.count(),
  };

  return NextResponse.json({
    wouldDelete: preview,
    totalWouldDelete: Object.values(preview).reduce((a, b) => a + b, 0),
    kept,
  });
}
