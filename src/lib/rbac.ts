/**
 * rbac — Centralized Role-Based Access Control + AccessGrant scoping.
 * This is the SINGLE PLACE in the codebase where role checks happen.
 *
 * Role values (course-centric architecture):
 *   pending | student | teaching_assistant | instructor | course_coordinator
 *   | counselor | guardian | principal | administrator | demo
 *
 * Backward-compat aliases (normalized transparently):
 *   "institution_admin" → "principal"
 *   "platform_admin"    → "administrator"
 *   "teacher"           → "instructor" (legacy pre-July 2026)
 *   "admin"             → "administrator" (legacy 4-role model)
 *
 * Course-Centric Architecture:
 *   - Students are enrolled in courses via CourseEnrollment
 *   - Instructors are assigned to courses via CourseEnrollment
 *   - Batch/BatchTeacher/Cohort removed entirely
 *   - getVisibleStudentIds uses CourseEnrollment instead of batchId
 */

import { getAuthUser, getCurrentUser } from "./auth";
import { db } from "./db";
import { NextResponse } from "next/server";

export function normalizeTier(tier: string | null | undefined): string {
  if (!tier) return "green";
  if (tier === "warning") return "warning";
  return tier;
}

export function normalizeSeverity(severity: string | null | undefined): string {
  if (!severity) return "warning";
  if (severity === "warning") return "warning";
  return severity;
}
import type { NextRequest } from "next/server";

export const UserRole = {
  PENDING: "pending",
  STUDENT: "student",
  TEACHING_ASSISTANT: "teaching_assistant",
  INSTRUCTOR: "instructor",
  COURSE_COORDINATOR: "course_coordinator",
  COUNSELOR: "counselor",
  GUARDIAN: "guardian",
  PRINCIPAL: "principal",
  ADMINISTRATOR: "administrator",
  DEMO: "demo",
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

export const ADMIN_ROLES: UserRoleValue[] = [
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.DEMO,
];

export const TECHNICAL_ROLES: UserRoleValue[] = [
  UserRole.ADMINISTRATOR,
];

export const STAFF_ROLES: UserRoleValue[] = [
  UserRole.INSTRUCTOR,
  UserRole.COURSE_COORDINATOR,
  UserRole.COUNSELOR,
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.DEMO,
];

export function isStaffRole(role: string): boolean {
  return hasRole(role, STAFF_ROLES) || role === "admin";
}

export const USER_MANAGEMENT_ROLES: UserRoleValue[] = [
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.INSTRUCTOR,
];

export { getAuthUser, getCurrentUser };

export const ROLE_LABELS: Record<string, string> = {
  pending: "Pending",
  student: "Student",
  teaching_assistant: "Teaching Assistant",
  instructor: "Instructor / Mentor",
  course_coordinator: "Course Coordinator",
  counselor: "Counselor",
  guardian: "Guardian",
  principal: "Principal",
  administrator: "Administrator",
  demo: "Demo (Read-Only)",
};

export function normalizeRole(role: string): UserRoleValue | null {
  const r = role?.toLowerCase();
  switch (r) {
    case "pending": return UserRole.PENDING;
    case "student": return UserRole.STUDENT;
    case "teaching_assistant": return UserRole.TEACHING_ASSISTANT;
    case "instructor": return UserRole.INSTRUCTOR;
    case "teacher": return UserRole.INSTRUCTOR;  // legacy alias
    case "course_coordinator": return UserRole.COURSE_COORDINATOR;
    case "counselor": return UserRole.COUNSELOR;
    case "guardian": return UserRole.GUARDIAN;
    case "principal":
    case "institution_admin":
    case "institution administrator":
      return UserRole.PRINCIPAL;
    case "administrator":
    case "platform_admin":
    case "platform administrator":
    case "admin":
      return UserRole.ADMINISTRATOR;
    case "demo":
      return UserRole.DEMO;
    default: return null;
  }
}

export function hasRole(userRole: string, allowed: UserRoleValue[]): boolean {
  const normalized = normalizeRole(userRole);
  if (normalized && allowed.includes(normalized)) return true;
  return false;
}

export interface AuthContext {
  payload: { sub: string; email: string; role: string; name: string };
  user: { id: string; role: string; name: string; email: string; courseIds: string[] } | null;
}

export async function requireRole(
  allowed: UserRoleValue[]
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const payload = await getAuthUser();
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(payload.role, allowed)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden — insufficient role" }, { status: 403 }) };
  }
  let user: AuthContext["user"] = null;
  try {
    const fullUser = await getCurrentUser();
    if (fullUser) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { userId: fullUser.id },
        select: { courseId: true },
      });
      user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, courseIds: enrollments.map(e => e.courseId) };
    }
  } catch { /* ignore */ }
  return { ok: true, ctx: { payload, user } };
}

export async function requireRoleOrSelf(
  allowed: UserRoleValue[],
  targetUserId: string
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const payload = await getAuthUser();
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (payload.sub === targetUserId) {
    let user: AuthContext["user"] = null;
    try {
      const fullUser = await getCurrentUser();
      if (fullUser) {
        const enrollments = await db.courseEnrollment.findMany({
          where: { userId: fullUser.id },
          select: { courseId: true },
        });
        user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, courseIds: enrollments.map(e => e.courseId) };
      }
    } catch { /* ignore */ }
    return { ok: true, ctx: { payload, user } };
  }
  return requireRole(allowed);
}

export type ScopeType = "course" | "student" | "institution";
export type DataScope = "full" | "wellbeing_only" | "crisis_only" | "content_only";

export async function hasAccessGrant(
  userId: string,
  userRole: string,
  scopeType: ScopeType,
  scopeId: string,
  requiredDataScope?: DataScope
): Promise<boolean> {
  if (hasRole(userRole, ADMIN_ROLES)) return true;
  const grant = await db.accessGrant.findFirst({
    where: { granteeUserId: userId, scopeType, scopeId, revokedAt: null },
  });
  if (!grant) return false;
  if (requiredDataScope && grant.dataScope !== "full") {
    if (grant.dataScope !== requiredDataScope) return false;
  }
  return true;
}

export async function requireAccessGrant(
  scopeType: ScopeType,
  scopeId: string,
  requiredDataScope?: DataScope
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const payload = await getAuthUser();
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const granted = await hasAccessGrant(payload.sub, payload.role, scopeType, scopeId, requiredDataScope);
  if (!granted) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden — no access grant for this scope" }, { status: 403 }) };
  }
  let user: AuthContext["user"] = null;
  try {
    const fullUser = await getCurrentUser();
    if (fullUser) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { userId: fullUser.id },
        select: { courseId: true },
      });
      user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, courseIds: enrollments.map(e => e.courseId) };
    }
  } catch { /* ignore */ }
  return { ok: true, ctx: { payload, user } };
}

export async function getVisibleStudentIds(userId: string, userRole: string): Promise<string[]> {
  if (hasRole(userRole, ADMIN_ROLES)) {
    const allStudents = await db.user.findMany({ where: { role: "student" }, select: { id: true } });
    return allStudents.map(u => u.id);
  }

  // Instructors see students enrolled in their courses
  if (userRole === UserRole.INSTRUCTOR || normalizeRole(userRole) === UserRole.INSTRUCTOR) {
    const instructorEnrollments = await db.courseEnrollment.findMany({
      where: { userId, role: "instructor" },
      select: { courseId: true },
    });
    const courseIds = instructorEnrollments.map(e => e.courseId);
    if (courseIds.length === 0) return [];

    const studentEnrollments = await db.courseEnrollment.findMany({
      where: { courseId: { in: courseIds }, role: "student" },
      select: { userId: true },
    });
    return [...new Set(studentEnrollments.map(e => e.userId))];
  }

  if (userRole === UserRole.COUNSELOR) {
    const grants = await db.accessGrant.findMany({
      where: { granteeUserId: userId, scopeType: "student", revokedAt: null },
      select: { scopeId: true },
    });
    return grants.map(g => g.scopeId);
  }

  return [];
}

export function getRequestIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}