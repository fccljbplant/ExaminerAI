/**
 * rbac — Centralized Role-Based Access Control + AccessGrant scoping.
 * This is the SINGLE PLACE in the codebase where role checks happen.
 *
 * Role values (4-role model + demo, post-purge 2026-08):
 *   learner | instructor | org_admin | platform_admin | demo
 *
 * `pending` is no longer a role — it is now a `User.status` field
 * (one of: pending | active | suspended).
 *
 * Backward-compat aliases (normalized transparently via normalizeRole):
 *   "student"           → "learner"
 *   "pending"           → "learner" (pending is now a status, not a role)
 *   "coordinator"       → "org_admin"
 *   "principal"         → "org_admin"
 *   "institution_admin" → "org_admin"
 *   "administrator"     → "platform_admin"
 *   "platform_admin"    → "platform_admin"
 *   "admin"             → "platform_admin" (legacy 4-role model)
 *   "teacher"           → "instructor" (legacy pre-July 2026)
 *   "teaching_assistant" → "instructor" (legacy pre-July 2026)
 *   "course_coordinator" → "org_admin"
 *   "counselor"         → "learner" (orphaned, default to learner)
 *   "guardian"          → "learner" (orphaned, default to learner)
 *   "demo"              → "demo"
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
  LEARNER: "learner",
  INSTRUCTOR: "instructor",
  ORG_ADMIN: "org_admin",
  PLATFORM_ADMIN: "platform_admin",
  DEMO: "demo",
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

export const ADMIN_ROLES: UserRoleValue[] = [
  UserRole.ORG_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.DEMO,
];

/** Platform-scoped roles — SaaS control-plane operations (tenant lifecycle,
 *  platform revenue, global AI limits, cache, feature flags). Org admins
 *  and demo accounts are deliberately EXCLUDED: their admin surface is the
 *  org portal, not the platform plane (2026-08-17 guard hygiene). */
export const PLATFORM_ADMIN_ROLES: UserRoleValue[] = [
  UserRole.PLATFORM_ADMIN,
];

export const TECHNICAL_ROLES: UserRoleValue[] = [
  UserRole.PLATFORM_ADMIN,
];

export const STAFF_ROLES: UserRoleValue[] = [
  UserRole.INSTRUCTOR,
  UserRole.ORG_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.DEMO,
];

export function isStaffRole(role: string): boolean {
  return hasRole(role, STAFF_ROLES);
}

export const USER_MANAGEMENT_ROLES: UserRoleValue[] = [
  UserRole.ORG_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.INSTRUCTOR,
];

export { getAuthUser, getCurrentUser };

export const ROLE_LABELS: Record<string, string> = {
  learner: "Learner",
  student: "Learner", // legacy alias
  instructor: "Instructor / Mentor",
  org_admin: "Org Admin",
  coordinator: "Org Admin", // legacy alias
  principal: "Org Admin", // legacy alias
  institution_admin: "Org Admin", // legacy alias
  platform_admin: "Platform Admin",
  administrator: "Platform Admin", // legacy alias
  admin: "Platform Admin", // legacy alias
  demo: "Demo (Read-Only)",
};

export function normalizeRole(role: string): UserRoleValue | null {
  const r = role?.toLowerCase();
  switch (r) {
    case "learner":
    case "student":
    case "pending": // pending is now a status, not a role — default to learner
    case "counselor": // orphaned role — default to learner
    case "guardian": // orphaned role — default to learner
      return UserRole.LEARNER;
    case "instructor":
    case "teacher": // legacy alias
    case "teaching_assistant": // legacy alias
      return UserRole.INSTRUCTOR;
    case "org_admin":
    case "coordinator": // legacy alias
    case "course_coordinator": // legacy alias
    case "principal": // legacy alias
    case "institution_admin": // legacy alias
    case "institution administrator":
      return UserRole.ORG_ADMIN;
    case "platform_admin":
    case "platform administrator":
    case "administrator": // legacy alias
    case "admin": // legacy alias
      return UserRole.PLATFORM_ADMIN;
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
    // Learners (students) are visible to admins.
    // Legacy "student" role value is kept in CourseEnrollment/DB rows —
    // normalizeRole maps it to "learner" but the DB still stores "student".
    const allStudents = await db.user.findMany({
      where: { OR: [{ role: "learner" }, { role: "student" }] },
      select: { id: true },
    });
    return allStudents.map(u => u.id);
  }

  // Instructors see students enrolled in their courses
  if (normalizeRole(userRole) === UserRole.INSTRUCTOR) {
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

  return [];
}

export function getRequestIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}
