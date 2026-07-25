/**
 * AI Assistant — Scope Resolver (Section 1)
 *
 * The single function every assistant call goes through FIRST.
 * Resolves the caller's accessible entities BEFORE any query or AI call —
 * the AI never receives data outside that scope.
 *
 * Security foundation: if this function is correct, the assistant cannot
 * leak data across role boundaries. Every section after this depends on it.
 */

import { db } from "@/lib/db";
import { getTeacherBatchIds } from "@/lib/batch-teachers";

export interface ScopeResult {
  /** All student IDs the caller can see */
  studentIds: string[];
  /** All teacher IDs the caller can see (for load/behavior queries) */
  teacherIds: string[];
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

/**
 * Resolve the caller's accessible entities based on their role.
 *
 * Per role:
 * - TEACHER / TEACHING_ASSISTANT: students in batches where BatchTeacher(callerId) exists
 * - COUNSELOR: teachers + students within their institution (behavior/wellbeing access)
 * - COURSE_COORDINATOR: course/batch structure within institution (not individual behavioral data)
 * - PRINCIPAL / ADMINISTRATOR / DEMO: entire institution
 *
 * Returns empty arrays if the caller has no accessible entities.
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

  // PRINCIPAL / ADMINISTRATOR / DEMO — entire institution
  const institutionWideRoles = ["principal", "administrator", "demo", "admin"];
  if (institutionWideRoles.includes(callerRole)) {
    const [students, teachers, courses, batches] = await Promise.all([
      db.user.findMany({
        where: { role: "student", institutionId: institutionId ?? undefined, blocked: false },
        select: { id: true },
      }),
      db.user.findMany({
        where: { role: "teacher", institutionId: institutionId ?? undefined },
        select: { id: true },
      }),
      db.course.findMany({
        where: { institutionId: institutionId ?? undefined },
        select: { id: true },
      }),
      db.batch.findMany({
        where: { course: { institutionId: institutionId ?? undefined } },
        select: { id: true },
      }),
    ]);

    return {
      studentIds: students.map(s => s.id),
      teacherIds: teachers.map(t => t.id),
      courseIds: courses.map(c => c.id),
      batchIds: batches.map(b => b.id),
      institutionId,
      isInstitutionWide: true,
      callerRole,
      callerId,
    };
  }

  // COUNSELOR — teachers + students within institution (behavior/wellbeing)
  if (callerRole === "counselor") {
    const [students, teachers] = await Promise.all([
      db.user.findMany({
        where: { role: "student", institutionId: institutionId ?? undefined, blocked: false },
        select: { id: true },
      }),
      db.user.findMany({
        where: { role: "teacher", institutionId: institutionId ?? undefined },
        select: { id: true },
      }),
    ]);

    return {
      studentIds: students.map(s => s.id),
      teacherIds: teachers.map(t => t.id),
      courseIds: [], // Counselors don't get curriculum access via scope
      batchIds: [], // Counselors don't get batch structure access via scope
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // COURSE_COORDINATOR — course/batch structure within institution
  if (callerRole === "course_coordinator") {
    const [courses, batches] = await Promise.all([
      db.course.findMany({
        where: { institutionId: institutionId ?? undefined },
        select: { id: true },
      }),
      db.batch.findMany({
        where: { course: { institutionId: institutionId ?? undefined } },
        select: { id: true },
      }),
    ]);

    return {
      studentIds: [], // Coordinators don't get individual student behavioral data via scope
      teacherIds: [],
      courseIds: courses.map(c => c.id),
      batchIds: batches.map(b => b.id),
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // TEACHER / TEACHING_ASSISTANT — students in their batches only
  const batchIds = await getTeacherBatchIds(callerId, callerRole);
  if (!batchIds || batchIds.length === 0) {
    return {
      studentIds: [],
      teacherIds: [callerId], // Teachers can see their own load
      courseIds: [],
      batchIds: batchIds ?? [],
      institutionId,
      isInstitutionWide: false,
      callerRole,
      callerId,
    };
  }

  // Get students in those batches
  const students = await db.user.findMany({
    where: { role: "student", batchId: { in: batchIds }, blocked: false },
    select: { id: true },
  });

  // Get courses for those batches
  const batchRecords = await db.batch.findMany({
    where: { id: { in: batchIds } },
    select: { courseId: true },
  });
  const courseIds = [...new Set(batchRecords.map(b => b.courseId).filter(Boolean))] as string[];

  return {
    studentIds: students.map(s => s.id),
    teacherIds: [callerId],
    courseIds,
    batchIds,
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
