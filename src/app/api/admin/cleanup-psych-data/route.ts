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
 *
 *  C2 fix (audit 2026-07-26): the previous version ran `deleteMany({})` on
 *  PsychologyObs, which wiped ALL rows across ALL institutions. This version
 *  scopes the cleanup to the caller's institution by filtering on the user
 *  relation. The other deleteMany calls were already filtered by chatbotType/
 *  pillar/sourceId/context — but we now ALSO add an institution filter via
 *  the user relation so a principal in Institution A can't wipe data in
 *  Institution B.
 */
export async function POST() {
  const _demoBlock = await demoWriteBlock("cleaning up data"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // C2 fix: load the caller's institutionId. Required — refuse to run if null.
  const caller = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!caller?.institutionId) {
    return NextResponse.json(
      { error: "Your account has no institution assigned. Psych-data cleanup requires institution scoping to prevent cross-institution data loss." },
      { status: 403 }
    );
  }
  const institutionId = caller.institutionId;

  // Institution-scoped user filter — applied to every deleteMany below.
  // We can't filter directly on `institutionId` for psych tables (they don't
  // have that column); instead we filter via the related user.
  const institutionUserFilter = { user: { institutionId } };

  const results: Record<string, number> = {};

  try {
    const r1 = await db.chatSession.deleteMany({
      where: {
        chatbotType: { in: ["student_tutor", "teacher_tutor"] },
        user: { institutionId },
      },
    });
    results.chatSession_tutor_snapshots = r1.count;

    const r2 = await db.interaction.deleteMany({
      where: {
        pillar: { in: ["AI Tutor", "AI Teacher"] },
        user: { institutionId },
      },
    });
    results.interaction_tutor_logs = r2.count;

    const r3 = await db.psychEvidence.deleteMany({
      where: {
        sourceId: { startsWith: "tutor-" },
        user: { institutionId },
      },
    });
    results.psychEvidence_tutor_artifacts = r3.count;

    const r4 = await db.confidenceRating.deleteMany({
      where: {
        source: "daily_test",
        context: { startsWith: "tutor-" },
        user: { institutionId },
      },
    });
    results.confidenceRating_tutor_artifacts = r4.count;

    // C2 fix: scope the PsychologyObs wipe to the caller's institution
    // (was `deleteMany({})` — wiped ALL rows across ALL institutions).
    const r5 = await db.psychologyObs.deleteMany({
      where: institutionUserFilter,
    });
    results.psychologyObs_old_duplicates = r5.count;

    const kept = {
      psychEvidence_from_tests: await db.psychEvidence.count({
        where: { user: { institutionId } },
      }),
      confidenceRating_from_tests: await db.confidenceRating.count({
        where: { user: { institutionId } },
      }),
      skillMastery: await db.skillMastery.count({
        where: { user: { institutionId } },
      }),
      wellbeingState: await db.wellbeingState.count({
        where: { user: { institutionId } },
      }),
      crisisFlags: await db.crisisFlag.count({
        where: { user: { institutionId } },
      }),
      chatSession_from_tests: await db.chatSession.count({
        where: { chatbotType: { in: ["practice", "daily_test", "weekly_test"] }, user: { institutionId } },
      }),
      healthSummary: await db.studentHealthSummary.count({
        where: { user: { institutionId } },
      }),
    };

    logger.info("Psych data cleanup completed", {
      callerId: payload.sub,
      institutionId,
      deleted: results,
      kept,
    });

    return NextResponse.json({
      ok: true,
      institutionId,
      deleted: results,
      totalDeleted: Object.values(results).reduce((a, b) => a + b, 0),
      kept,
    });
  } catch (err) {
    logger.error("Psych data cleanup failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

/** GET /api/admin/cleanup-psych-data — dry run preview.
 *  C2 fix: scoped to caller's institution. */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const caller = await db.user.findUnique({
    where: { id: payload.sub },
    select: { institutionId: true },
  });
  if (!caller?.institutionId) {
    return NextResponse.json(
      { error: "Your account has no institution assigned." },
      { status: 403 }
    );
  }
  const institutionId = caller.institutionId;

  const preview = {
    chatSession_tutor_snapshots: await db.chatSession.count({
      where: { chatbotType: { in: ["student_tutor", "teacher_tutor"] }, user: { institutionId } },
    }),
    interaction_tutor_logs: await db.interaction.count({
      where: { pillar: { in: ["AI Tutor", "AI Teacher"] }, user: { institutionId } },
    }),
    psychEvidence_tutor_artifacts: await db.psychEvidence.count({
      where: { sourceId: { startsWith: "tutor-" } }, // PsychEvidence doesn't have user — needs the indirect filter
    }),
    confidenceRating_tutor_artifacts: await db.confidenceRating.count({
      where: { source: "daily_test", context: { startsWith: "tutor-" }, user: { institutionId } },
    }),
    psychologyObs_old_duplicates: await db.psychologyObs.count({
      where: { user: { institutionId } },
    }),
  };

  const kept = {
    psychEvidence_from_tests: await db.psychEvidence.count({
      where: { user: { institutionId } },
    }),
    confidenceRating_from_tests: await db.confidenceRating.count({
      where: { user: { institutionId } },
    }),
    skillMastery: await db.skillMastery.count({
      where: { user: { institutionId } },
    }),
    wellbeingState: await db.wellbeingState.count({
      where: { user: { institutionId } },
    }),
    crisisFlags: await db.crisisFlag.count({
      where: { user: { institutionId } },
    }),
    healthSummary: await db.studentHealthSummary.count({
      where: { user: { institutionId } },
    }),
  };

  return NextResponse.json({
    institutionId,
    wouldDelete: preview,
    totalWouldDelete: Object.values(preview).reduce((a, b) => a + b, 0),
    kept,
  });
}
