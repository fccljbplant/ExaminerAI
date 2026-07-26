/**
 * buildTeacherBatchSummary — shared helper that produces a compact
 * per-student summary for a teacher's batch.
 *
 * Used by:
 *   - AI Co-pilot query box (Today view)
 *   - "Explain this student" (student detail panel)
 *   - Existing Psych/Educational tabs (migration TODO — they currently
 *     compute this data independently, which causes "same number
 *     computed differently in different tabs" bugs)
 *
 * Data assembled per student:
 *   - Latest PsychEvidence per dimension
 *   - ConfidenceRating calibration gap (rating vs actualScore)
 *   - SkillMastery trend
 *   - Days since last MentorshipTouchpoint
 *   - Open CrisisFlag count
 *   - WellbeingState tier
 *   - Latest Interaction correctness + topic
 *   - Latest WeeklyTest score
 */

import { db } from "@/lib/db";
import { getTeacherBatchIds } from "@/lib/batch-teachers";

export interface StudentSummary {
  userId: string;
  name: string;
  email: string;
  currentWeek: number;
  progress: number;
  lastActive: string | null;
  wellbeingTier: string | null;
  wellbeingReasons: string[];
  psychEvidence: Array<{
    dimension: string;
    value: string;
    evidenceText: string;
    week: number | null;
    createdAt: string;
  }>;
  calibrationGap: number | null; // positive = overconfident, negative = underconfident
  skillMastery: Array<{
    topic: string;
    masteryLevel: string;
    trend: string;
    evidenceCount: number;
  }>;
  daysSinceTouchpoint: number | null;
  openCrisisFlags: number;
  latestInteractionScore: number | null;
  latestInteractionTopic: string | null;
  latestWeeklyTestScore: number | null;
  latestWeeklyTestWeek: number | null;
}

export interface BatchSummary {
  teacherId: string;
  totalStudents: number;
  students: StudentSummary[];
  generatedAt: string;
}

/** Build a compact batch summary for a teacher.
 *
 *  @param teacherId — the teacher's user ID
 *  @param studentIds — optional: limit to specific student IDs (for
 *    co-pilot queries scoped to a subset). If omitted, all students
 *    in the teacher's batches are included.
 *
 *  H5 fix (audit 2026-07-26): the previous version used `teacher.batchId`
 *  (legacy single-batch field) to find the teacher's students. With the
 *  multi-teacher BatchTeacher junction, a teacher can be assigned to
 *  multiple batches — but this function only saw the legacy batchId, so
 *  students in the teacher's OTHER batches were invisible. Now uses
 *  `getTeacherBatchIds()` which checks BOTH the BatchTeacher junction AND
 *  the legacy batchId for backward compat.
 */
export async function buildTeacherBatchSummary(
  teacherId: string,
  studentIds?: string[],
  role?: string,
): Promise<BatchSummary> {
  // H5 fix: use getTeacherBatchIds() instead of teacher.batchId — supports
  // multi-batch teachers via the BatchTeacher junction.
  // HI-7 fix: accept the caller's role — was hardcoded to "teacher", so
  // counselors/principals/admins calling /api/teacher/assistant got empty
  // results because getTeacherBatchIds returns null for admin roles (meaning
  // "unrestricted"), but the null check returned empty.
  const callerRole = role || "teacher";
  const teacherBatchIds = await getTeacherBatchIds(teacherId, callerRole);

  // HI-7 fix: null means admin/principal (unrestricted access) — don't return
  // empty, use getBatchFilter instead to get all institution students.
  if (teacherBatchIds !== null && teacherBatchIds.length === 0) {
    // Non-admin with no batches — return empty summary
    return { teacherId, totalStudents: 0, students: [], generatedAt: new Date().toISOString() };
  }

  // Get students in ANY of the teacher's batches (or the specified subset)
  // HI-7 fix: when teacherBatchIds is null (admin), use getBatchFilter for institution scoping
  const { getBatchFilter } = await import("@/lib/batch-teachers");
  const batchFilter = teacherBatchIds === null
    ? await getBatchFilter(teacherId, callerRole)
    : { batchId: { in: teacherBatchIds } };

  const students = await db.user.findMany({
    where: {
      role: "student",
      blocked: false,
      // If studentIds is provided, filter to those; otherwise use batch filter
      ...(studentIds
        ? { id: { in: studentIds } }
        : batchFilter),
    },
    select: {
      id: true, name: true, email: true, currentWeek: true,
      lastLogin: true,
    },
    take: 200, // safety cap
  });

  if (students.length === 0) {
    return { teacherId, totalStudents: 0, students: [], generatedAt: new Date().toISOString() };
  }

  // Batch-fetch all related data for these students in parallel
  const studentIdsList = students.map(s => s.id);
  const now = new Date();

  const [psychEvidence, confidenceRatings, skillMastery, touchpoints, crisisFlags, interactions, weeklyTests, wellbeingStates, tasks] = await Promise.all([
    // Latest psych evidence per dimension per student
    db.psychEvidence.findMany({
      where: { userId: { in: studentIdsList } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    // Confidence ratings for calibration gap
    db.confidenceRating.findMany({
      where: { userId: { in: studentIdsList }, actualScore: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    // Skill mastery
    db.skillMastery.findMany({
      where: { userId: { in: studentIdsList } },
      take: 500,
    }),
    // Touchpoints — latest per student
    db.mentorshipTouchpoint.findMany({
      where: { userId: { in: studentIdsList } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    // Open crisis flags
    db.crisisFlag.findMany({
      where: { userId: { in: studentIdsList }, status: "open" },
      select: { userId: true, severity: true, category: true },
    }),
    // Latest interactions
    db.interaction.findMany({
      where: { userId: { in: studentIdsList } },
      orderBy: { date: "desc" },
      select: { userId: true, correctness: true, topic: true, date: true },
      take: 500,
    }),
    // Weekly tests
    db.weeklyTest.findMany({
      where: { userId: { in: studentIdsList }, status: "completed" },
      orderBy: { week: "desc" },
      select: { userId: true, score: true, week: true },
      take: 500,
    }),
    // Wellbeing states
    db.wellbeingState.findMany({
      where: { userId: { in: studentIdsList } },
      select: { userId: true, tier: true, reasonsJson: true },
    }),
    // Tasks for progress computation
    db.projectTask.findMany({
      where: { userId: { in: studentIdsList } },
      select: { userId: true, status: true },
    }),
  ]);

  // Build per-student summaries
  const summaries: StudentSummary[] = students.map(student => {
    const studentEvidence = psychEvidence.filter(e => e.userId === student.id);
    // Keep only the latest per dimension
    const seenDimensions = new Set<string>();
    const latestEvidence = studentEvidence.filter(e => {
      if (seenDimensions.has(e.dimension)) return false;
      seenDimensions.add(e.dimension);
      return true;
    });

    const studentRatings = confidenceRatings.filter(r => r.userId === student.id);
    const avgRating = studentRatings.length > 0
      ? studentRatings.reduce((a, r) => a + r.rating * 20, 0) / studentRatings.length
      : null;
    const avgActual = studentRatings.length > 0
      ? studentRatings.reduce((a, r) => a + (r.actualScore ?? 0), 0) / studentRatings.length
      : null;
    const calibrationGap = (avgRating !== null && avgActual !== null)
      ? Math.round(avgRating - avgActual)
      : null;

    const studentMastery = skillMastery.filter(m => m.userId === student.id);
    const studentTouchpoints = touchpoints.filter(t => t.userId === student.id);
    const latestTouchpoint = studentTouchpoints[0];
    const daysSinceTouchpoint = latestTouchpoint
      ? Math.floor((now.getTime() - new Date(latestTouchpoint.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const studentFlags = crisisFlags.filter(f => f.userId === student.id);
    const studentInteractions = interactions.filter(i => i.userId === student.id);
    const latestInteraction = studentInteractions[0];
    const studentTests = weeklyTests.filter(t => t.userId === student.id);
    const latestTest = studentTests[0];

    const wellbeing = wellbeingStates.find(w => w.userId === student.id);
    let wellbeingReasons: string[] = [];
    try { wellbeingReasons = JSON.parse(wellbeing?.reasonsJson || "[]"); } catch { wellbeingReasons = []; }

    const studentTasks = tasks.filter(t => t.userId === student.id);
    const completedTasks = studentTasks.filter(t => t.status === "completed").length;
    const progress = studentTasks.length > 0 ? Math.round((completedTasks / studentTasks.length) * 100) : 0;

    return {
      userId: student.id,
      name: student.name,
      email: student.email,
      currentWeek: student.currentWeek,
      progress,
      lastActive: student.lastLogin?.toISOString() || null,
      wellbeingTier: wellbeing?.tier || null,
      wellbeingReasons,
      psychEvidence: latestEvidence.map(e => ({
        dimension: e.dimension,
        value: e.value,
        evidenceText: e.evidenceText,
        week: e.week,
        createdAt: e.createdAt.toISOString(),
      })),
      calibrationGap,
      skillMastery: studentMastery.map(m => ({
        topic: m.topic,
        masteryLevel: m.masteryLevel,
        trend: m.trend,
        evidenceCount: m.evidenceCount,
      })),
      daysSinceTouchpoint,
      openCrisisFlags: studentFlags.length,
      latestInteractionScore: latestInteraction?.correctness ?? null,
      latestInteractionTopic: latestInteraction?.topic ?? null,
      latestWeeklyTestScore: latestTest?.score ?? null,
      latestWeeklyTestWeek: latestTest?.week ?? null,
    };
  });

  return {
    teacherId,
    totalStudents: summaries.length,
    students: summaries,
    generatedAt: new Date().toISOString(),
  };
}
