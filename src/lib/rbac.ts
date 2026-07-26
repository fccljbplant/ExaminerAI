/**
 * rbac — Centralized Role-Based Access Control + AccessGrant scoping.
 * This is the SINGLE PLACE in the codebase where role checks happen.
 *
 * Role values (per user clarification 2026-07-20):
 *   pending | student | teaching_assistant | teacher | course_coordinator
 *   | counselor | guardian | principal | administrator | demo
 *
 * Backward-compat aliases (normalized transparently):
 *   "institution_admin" → "principal"
 *   "platform_admin"    → "administrator"
 *   "admin"             → "administrator" (legacy 4-role model)
 *
 * Role purposes:
 *   - principal      — sets escalation policy, mandatory second crisis-notification
 *                      recipient, manages role assignment within their institution.
 *   - administrator  — operational/admin: manages users, system config, but does
 *                      NOT default to seeing individual crisis content (operational
 *                      access, not pastoral access).
 *   - demo            — read-only preview: deploys, env vars, DB ops, debug.
 *                      
 *                      scope (system health, AI provider config, logs) but less
 *                      people-management scope (cannot change roles, cannot see
 *                      crisis content). Split because deploy access and pastoral
 *                      access should be different boundaries.
 */

import { getAuthUser, getCurrentUser } from "./auth";
import { db } from "./db";
import { NextResponse } from "next/server";

// ============================================================
// Wellbeing tier normalization — "warning" (legacy) → "warning" (canonical)
// ============================================================

/** Normalize wellbeing tier: "warning" → "warning". Other values pass through.
 *  This ensures old DB records with "warning" work with new code that uses "warning". */
export function normalizeTier(tier: string | null | undefined): string {
  if (!tier) return "green";
  if (tier === "warning") return "warning";
  return tier;
}

/** Normalize severity: "warning" → "warning". Other values pass through. */
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
  TEACHER: "teacher",
  COURSE_COORDINATOR: "course_coordinator",
  COUNSELOR: "counselor",
  GUARDIAN: "guardian",
  PRINCIPAL: "principal",
  ADMINISTRATOR: "administrator",
  DEMO: "demo",
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

/** Admin roles — principal + administrator + demo.
 *  Demo is included so the demo account can preview all admin dashboards
 *  in read-only mode. Writes are blocked by demoWriteBlock(). */
export const ADMIN_ROLES: UserRoleValue[] = [
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.DEMO,
];

/** Technical roles — administrator only. Demo is NOT technical — it's a
 *  read-only preview role with NO system-level capabilities. */
export const TECHNICAL_ROLES: UserRoleValue[] = [
  UserRole.ADMINISTRATOR,
];

/** Staff roles — anyone who isn't a student/pending/guardian.
 *  Used for API routes that should be accessible to all staff (teachers,
 *  TAs, coordinators, counselors, admins) but NOT students. */
export const STAFF_ROLES: UserRoleValue[] = [
  UserRole.TEACHER,
  UserRole.COURSE_COORDINATOR,
  UserRole.COUNSELOR,
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.DEMO,
];

/** Check if a role is staff (any non-student/pending/guardian role). */
export function isStaffRole(role: string): boolean {
  return hasRole(role, STAFF_ROLES) || role === "admin"; // legacy alias
}

/** Roles that can manage users (approve/block/role-change) within their institution. */
export const USER_MANAGEMENT_ROLES: UserRoleValue[] = [
  UserRole.PRINCIPAL,
  UserRole.ADMINISTRATOR,
  UserRole.TEACHER, // can approve pending students in their batch
];

export { getAuthUser, getCurrentUser };

/** Role display labels — for UI rendering. */
export const ROLE_LABELS: Record<string, string> = {
  pending: "Pending",
  student: "Student",
  teaching_assistant: "Teaching Assistant",
  teacher: "Teacher / Mentor",
  course_coordinator: "Course Coordinator",
  counselor: "Counselor",
  guardian: "Guardian",
  principal: "Principal",
  administrator: "Administrator",
  demo: "Demo (Read-Only)",
};

/** Normalize any role string (including legacy aliases) to canonical form. */
export function normalizeRole(role: string): UserRoleValue | null {
  const r = role?.toLowerCase();
  switch (r) {
    case "pending": return UserRole.PENDING;
    case "student": return UserRole.STUDENT;
    case "teaching_assistant": return UserRole.TEACHING_ASSISTANT;
    case "teacher": return UserRole.TEACHER;
    case "course_coordinator": return UserRole.COURSE_COORDINATOR;
    case "counselor": return UserRole.COUNSELOR;
    case "guardian": return UserRole.GUARDIAN;
    case "principal":
    case "institution_admin":       // legacy alias
    case "institution administrator":
      return UserRole.PRINCIPAL;
    case "administrator":
    case "platform_admin":          // legacy alias
    case "platform administrator":
    case "admin":                   // legacy 4-role alias
      return UserRole.ADMINISTRATOR;
    case "demo":
    case "demo":  // legacy alias
      return UserRole.DEMO;
    default: return null;
  }
}

/** Does the user's role match any of the allowed roles?
 *  Handles all legacy aliases transparently. */
export function hasRole(userRole: string, allowed: UserRoleValue[]): boolean {
  const normalized = normalizeRole(userRole);
  if (normalized && allowed.includes(normalized)) return true;
  return false;
}

export interface AuthContext {
  payload: { sub: string; email: string; role: string; name: string };
  user: { id: string; role: string; name: string; email: string; batchId: string | null } | null;
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
      user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, batchId: fullUser.batchId };
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
        user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, batchId: fullUser.batchId };
      }
    } catch { /* ignore */ }
    return { ok: true, ctx: { payload, user } };
  }
  return requireRole(allowed);
}

export type ScopeType = "batch" | "student" | "course" | "institution";
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
      user = { id: fullUser.id, role: fullUser.role, name: fullUser.name, email: fullUser.email, batchId: fullUser.batchId };
    }
  } catch { /* ignore */ }
  return { ok: true, ctx: { payload, user } };
}

export async function getVisibleStudentIds(userId: string, userRole: string): Promise<string[]> {
  if (hasRole(userRole, ADMIN_ROLES)) {
    const allStudents = await db.user.findMany({ where: { role: "student" }, select: { id: true } });
    return allStudents.map(u => u.id);
  }
  if (userRole === UserRole.TEACHER ) {
    const teacher = await db.user.findUnique({ where: { id: userId }, select: { batchId: true } });
    if (!teacher?.batchId) return [];
    const batchStudents = await db.user.findMany({ where: { role: "student", batchId: teacher.batchId }, select: { id: true } });
    return batchStudents.map(u => u.id);
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
