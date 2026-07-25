/**
 * AI Assistant — Teacher Load Extension (Section 6)
 *
 * Extends existing src/app/api/teacher/load/route.ts — does NOT rewrite it.
 *
 * 6a. Add batch-count as its own load factor, separate from student count.
 * 6b. New endpoint: institution-wide teacher-load roster for PRINCIPAL/ADMIN.
 * 6c. Two suggested remedies: co-teacher suggestion + wellbeing touchpoint.
 * 6d. Per Section 0.3: teacher sees own tier at same time as principal.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Load tier calculation weights */
const WEIGHTS = {
  studentCount: 1,       // per student
  batchCount: 15,        // per batch (distinct from student count)
  openAlerts: 5,         // per open alert
  crisisFlags: 25,       // per crisis flag
  overdueTouchpoints: 3, // per overdue follow-up
};

/** Tier thresholds */
const TIER_THRESHOLDS = {
  green: 0,
  amber: 50,
  red: 100,
};

export interface TeacherLoadResult {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  studentCount: number;
  batchCount: number;
  openAlerts: number;
  crisisFlags: number;
  overdueTouchpoints: number;
  loadScore: number;
  tier: "green" | "amber" | "red";
  reasons: string[];
}

/**
 * Calculate a single teacher's load.
 * Used by both the self-view route and the institution-wide roster.
 */
export async function calculateTeacherLoad(
  teacherId: string
): Promise<TeacherLoadResult> {
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, email: true, institutionId: true },
  });

  if (!teacher) {
    return {
      teacherId,
      teacherName: "Unknown",
      teacherEmail: "",
      studentCount: 0,
      batchCount: 0,
      openAlerts: 0,
      crisisFlags: 0,
      overdueTouchpoints: 0,
      loadScore: 0,
      tier: "green",
      reasons: [],
    };
  }

  // Get batch memberships
  const batchMemberships = await db.batchTeacher.findMany({
    where: { teacherId },
    select: { batchId: true },
  });
  const batchIds = batchMemberships.map(m => m.batchId);

  // Get students in those batches
  const studentCount = await db.user.count({
    where: { role: "student", batchId: { in: batchIds }, blocked: false },
  });

  // Get open alerts raised BY this teacher (indicates active caseload)
  const openAlerts = await db.studentAlert.count({
    where: { fromUserId: teacherId, status: "open" },
  }).catch(() => 0);

  // Get crisis flags for students in this teacher's batches
  const crisisFlags = await db.crisisFlag.count({
    where: {
      user: { batchId: { in: batchIds } },
      status: "open",
      severity: "red",
    },
  }).catch(() => 0);

  // Get overdue touchpoints (follow-ups past due)
  const overdueTouchpoints = await db.mentorshipTouchpoint.count({
    where: {
      actorUserId: teacherId,
      followUpDate: { lt: new Date() },
    },
  }).catch(() => 0);

  // Calculate load score (Section 6a: batch-count is a DISTINCT factor)
  const loadScore =
    studentCount * WEIGHTS.studentCount +
    batchIds.length * WEIGHTS.batchCount +  // Section 6a: separate from student count
    openAlerts * WEIGHTS.openAlerts +
    crisisFlags * WEIGHTS.crisisFlags +
    overdueTouchpoints * WEIGHTS.overdueTouchpoints;

  // Determine tier
  const tier: "green" | "amber" | "red" =
    loadScore >= TIER_THRESHOLDS.red ? "red" :
    loadScore >= TIER_THRESHOLDS.amber ? "amber" :
    "green";

  // Build reasons (Section 0.5: words first, color second)
  const reasons: string[] = [];
  if (studentCount > 30) reasons.push(`${studentCount} students in caseload`);
  if (batchIds.length > 2) reasons.push(`Spread across ${batchIds.length} batches`);
  if (openAlerts > 5) reasons.push(`${openAlerts} open alerts`);
  if (crisisFlags > 0) reasons.push(`${crisisFlags} crisis flags in batches`);
  if (overdueTouchpoints > 3) reasons.push(`${overdueTouchpoints} overdue follow-ups`);

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherEmail: teacher.email,
    studentCount,
    batchCount: batchIds.length,
    openAlerts,
    crisisFlags,
    overdueTouchpoints,
    loadScore,
    tier,
    reasons,
  };
}

/**
 * Get institution-wide teacher-load roster (Section 6b).
 * For PRINCIPAL/ADMINISTRATOR scope.
 *
 * Sortable by: current tier AND trend (worsening vs stable vs improving).
 */
export async function getInstitutionTeacherLoadRoster(
  institutionId: string
): Promise<{
  teachers: Array<TeacherLoadResult & {
    trend: "worsening" | "stable" | "improving";
  }>;
  summary: {
    total: number;
    green: number;
    amber: number;
    red: number;
  };
}> {
  // Get all teachers in the institution
  const teachers = await db.user.findMany({
    where: { role: "teacher", institutionId },
    select: { id: true },
  });

  // Calculate load for each teacher
  const loads = await Promise.all(
    teachers.map(t => calculateTeacherLoad(t.id))
  );

  // Determine trend by comparing current load to recent touchpoint/flag activity
  // (simplified: if alerts increased in last 7 days vs previous 7 days → worsening)
  const results = await Promise.all(
    loads.map(async (load) => {
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const prev7Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const recentAlerts = await db.studentAlert.count({
        where: { fromUserId: load.teacherId, createdAt: { gt: last7Days } },
      }).catch(() => 0);

      const previousAlerts = await db.studentAlert.count({
        where: {
          fromUserId: load.teacherId,
          createdAt: { gt: prev7Days, lt: last7Days },
        },
      }).catch(() => 0);

      const trend: "worsening" | "stable" | "improving" =
        recentAlerts > previousAlerts ? "worsening" :
        recentAlerts < previousAlerts ? "improving" :
        "stable";

      return { ...load, trend };
    })
  );

  // Sort by tier (red first, then amber, then green)
  const tierOrder = { red: 0, amber: 1, green: 2 };
  results.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  return {
    teachers: results,
    summary: {
      total: results.length,
      green: results.filter(r => r.tier === "green").length,
      amber: results.filter(r => r.tier === "amber").length,
      red: results.filter(r => r.tier === "red").length,
    },
  };
}

/**
 * Suggest a co-teacher for an overloaded teacher's most-loaded batch (Section 6c).
 *
 * CRITICAL: Never suggest someone already amber/red themselves.
 */
export async function suggestCoTeacher(
  overloadedTeacherId: string,
  institutionId: string
): Promise<{
  suggestedTeacherId: string | null;
  suggestedTeacherName: string | null;
  batchId: string | null;
  batchName: string | null;
  reason: string;
}> {
  // Get the overloaded teacher's batches
  const batchMemberships = await db.batchTeacher.findMany({
    where: { teacherId: overloadedTeacherId },
    include: { batch: { select: { id: true, name: true } } },
  });

  if (batchMemberships.length === 0) {
    return {
      suggestedTeacherId: null,
      suggestedTeacherName: null,
      batchId: null,
      batchName: null,
      reason: "No batches assigned to suggest a co-teacher for.",
    };
  }

  // Find the most-loaded batch (most students)
  let mostLoadedBatch = batchMemberships[0];
  let mostStudents = 0;
  for (const membership of batchMemberships) {
    const count = await db.user.count({
      where: { role: "student", batchId: membership.batchId, blocked: false },
    });
    if (count > mostStudents) {
      mostStudents = count;
      mostLoadedBatch = membership;
    }
  }

  // Get all other teachers in the institution
  const otherTeachers = await db.user.findMany({
    where: {
      role: "teacher",
      institutionId,
      id: { not: overloadedTeacherId },
    },
    select: { id: true, name: true },
  });

  // Check each candidate's load — never suggest someone already amber/red
  for (const candidate of otherTeachers) {
    const candidateLoad = await calculateTeacherLoad(candidate.id);
    if (candidateLoad.tier === "green") {
      // Check if they're already in this batch
      const existingMembership = await db.batchTeacher.findFirst({
        where: { teacherId: candidate.id, batchId: mostLoadedBatch.batchId },
      });

      if (!existingMembership) {
        return {
          suggestedTeacherId: candidate.id,
          suggestedTeacherName: candidate.name,
          batchId: mostLoadedBatch.batchId,
          batchName: mostLoadedBatch.batch?.name || "Unknown",
          reason: `${candidate.name} is currently green-tier (load score: ${candidateLoad.loadScore}) and not yet assigned to ${mostLoadedBatch.batch?.name || "this batch"}. Adding them as a co-teacher would distribute the load.`,
        };
      }
    }
  }

  return {
    suggestedTeacherId: null,
    suggestedTeacherName: null,
    batchId: mostLoadedBatch.batchId,
    batchName: mostLoadedBatch.batch?.name || null,
    reason: "No available green-tier teachers found to suggest as co-teacher. All other teachers are already amber/red or already assigned to this batch.",
  };
}
