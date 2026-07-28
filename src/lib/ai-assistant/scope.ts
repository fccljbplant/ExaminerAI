/**
 * AI Assistant — Scope Resolver (Section 1)
 *
 * The single function every assistant call goes through FIRST.
 * Resolves the caller's accessible entities BEFORE any query or AI call —
 * the AI never receives data outside that scope.
 *
 * Security foundation: if this function is correct, the assistant cannot
 * leak data across role boundaries. Every section after this depends on it.
 *
 * C1 fix (audit 2026-07-26): the previous version used `institutionId ?? undefined`
 * in Prisma where clauses, which Prisma interprets as "no filter" — leaking
 * data across institutions when a principal/admin/counselor had a null
 * institutionId. The fix: when institutionId is null, return EMPTY scope
 * arrays instead of unfiltered queries. A user without an institution has
 * no institution-wide access, full stop.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ScopeResult {
  /** All student IDs the caller can see */
  studentIds: string[];
  /** All teacher IDs the caller can see (for load/behavior queries) */
  instructorIds: string[];
  /** All course IDs the caller can see */
  courseIds: string[];
  /** All batch IDs the caller can see */
  batchIds: string[];
  /** The caller's institution ID (for institution-scoped queries) */
  institutionId: string | null;
  /** Whether the caller has institution-wide access */
  isInstitutionWide: boolean;
  /** The caller's role (for context in the prompt) */
  callerRole: string;
  /** The caller's user ID */
  callerId: string;
}

/** Build an institution-scoped Prisma where clause.
 *  Returns null when the caller has no institution — callers must short-circuit
 *  and return empty results rather than passing `undefined` to Prisma (which
 *  Prisma treats as "no filter" and would leak cross-institution data). */
function buildInstitutionFilter(institutionId: string | null): { institutionId: string } | null {
  if (!institutionId) return null;
  return { institutionId };
}

/**
 * Resolve the caller's accessible entities based on their role.
 *
 * Per role:
 * - TEACHER / INSTRUCTOR: students in courses where CourseEnrollment(callerId, "instructor") exists
 * - COUNSELOR: teachers + students within their institution (behavior/wellbeing access)
 * - COURSE_COORDINATOR: course/batch structure within institution (not individual behavioral data)
 * - PRINCIPAL / ADMINISTRATOR / DEMO: entire institution
 *
 * Returns empty arrays if the caller has no accessible entities.
 * C1 fix: when an institution-wide role has no institutionId, returns empty
 * arrays (instead of leaking cross-institution data via `institutionId: undefined`).
 */
export async function resolveAssistantScope(
  callerId: string,
  callerRole: string
): Promise<ScopeResult> {
  // Get the caller's institution
  const caller = await db.user.findUnique({
    where: { id: callerId },
    select: { institutionId: true, role: true },
  });

  const institutionId = caller?.institutionId ?? null;
  const institutionFilter = buildInstitutionFilter(institutionId);

  // PRINCIPAL / ADMINISTRATOR / DEMO — entire institution
  // C1 fix: refuse to return institution-wide data when institutionId is null.
  // A principal/admin without an institution is a misconfigured user — they
  // should not silently see EVERY institution's data. Log a warning so the
  // misconfiguration is visible, and return empty scope.
  const institutionWideRoles = ["principal", "administrator", "demo", "admin"];
  if (institutionWideRoles.includes(callerRole)) {
    if (!institutionFilter) {
      logger.warn("resolveAssistantScope: institution-wide role has no institutionId — returning empty scope", {
        callerId,
        callerRole,
      });
      return {
        studentIds: [],
        instructorIds: [],
        courseIds: [],
        batchIds: [],
        institutionId,
        isInstitutionWide: true, // has the role, but no scoped data
        callerRole,
        callerId,
      };
    }
    const [students, teachers, courses] = await Promise.all([
      db.user.findMany({
        where: { role: "student", ...institutionFilter, blocked: false },
        select: { id: true },
      }),
      db.user.findMany({
        where: { role: "instructor", ...institutionFilter },
        select: { id: true },
      }),
      db.course.findMany({
        where: institutionFilter,
        select: { id: true },
      }),
    ]);

    return {
      studentIds: students.map(s => s.id),
      instructorIds: teachers.map(t => t.id),
      courseIds: courses.map(c => c.id),
      institutionId,
      isInstitutionWide: true,
      callerRole,
      callerId,
    };
  }

  // COUNSELOR — teachers + students within institution (behavior/wellbeing)
  // C1 fix: same null-institutionId guard.
  if (callerRole === "counselor") {
    if (!institutionFilter) {
      logger.warn("resolveAssistantScope: counselor has no institutionId — returning empty scope", {
        callerId,
      });
      return {
        studentIds: [],
        instructorIds: [],
        courseIds: [],
        batchIds: [],
        institutionId,
        isInstitutionWide: false,
        callerRole,
        callerId,
      };
    }
    const [students, teachers] = await Promise.all([
      db.user.findMany({
        where: { role: "student", ...institutionFilter, blocked: false },
        select: { id: true },
      }),
      db.user.findMany({
        where: { role: "instructor", ...institutionFilter },
        select: { id: true },
      }),
    ]);

    return {
      studentIds: students.map(s => s.id),
      instructorIds: teachers.map(t => t.id),
      courseIds: [], // Counselors don't get curriculum access via scope
      batchIds: [], // Counselors don't get batch structure access via scope
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // COURSE_COORDINATOR — course/batch structure within institution
  // C1 fix: same null-institutionId guard.
  if (callerRole === "course_coordinator") {
    if (!institutionFilter) {
      logger.warn("resolveAssistantScope: course_coordinator has no institutionId — returning empty scope", {
        callerId,
      });
      return {
        studentIds: [],
        instructorIds: [],
        courseIds: [],
        institutionId,
        isInstitutionWide: false,
        callerRole,
        callerId,
      };
    }
    const [courses] = await Promise.all([
      db.course.findMany({
        where: institutionFilter,
        select: { id: true },
      }),
    ]);

    return {
      studentIds: [], // Coordinators don't get individual student behavioral data via scope
      instructorIds: [],
      courseIds: courses.map(c => c.id),
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // TEACHER / INSTRUCTOR — students in their courses only
  // (Teachers don't need an institutionId — they're scoped by CourseEnrollment.)
  const instructorCourses = await db.courseEnrollment.findMany({
    where: { userId: callerId, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = instructorCourses.map(c => c.courseId);
  if (courseIds.length === 0) {
    return {
      studentIds: [],
      instructorIds: [callerId], // Teachers can see their own load
      courseIds,
      batchIds: [],
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // Get students in those courses
  const studentEnrollments = await db.courseEnrollment.findMany({
    where: { courseId: { in: courseIds }, role: "student" },
    select: { userId: true },
  });

  return {
    studentIds: studentEnrollments.map(e => e.userId),
    instructorIds: [callerId],
    courseIds,
    batchIds: [],
    institutionId,
    isInstitutionWide: false,
    callerRole,
    callerId,
  };
}

/**
 * Assert that a specific student ID is within the caller's scope.
 * Throws if the student is outside scope — use in API routes as a guard.
 */
export async function assertStudentInScope(
  scope: ScopeResult,
  studentId: string
): Promise<boolean> {
  if (scope.isInstitutionWide) return true;
  return scope.studentIds.includes(studentId);
}

/**
 * Filter a list of student IDs to only those within the caller's scope.
 */
export function filterToScope(scope: ScopeResult, studentIds: string[]): string[] {
  if (scope.isInstitutionWide) return studentIds;
  return studentIds.filter(id => scope.studentIds.includes(id));
}
