/**
 * Client-side role helpers — mirrors src/lib/rbac.ts for use in components.
 *
 * 4-role model + demo (post-purge 2026-08):
 *   learner | instructor | org_admin | platform_admin | demo
 *
 * `pending` is no longer a role — it's now a `User.status` field.
 */

export const UserRole = {
  LEARNER: "learner",
  INSTRUCTOR: "instructor",
  ORG_ADMIN: "org_admin",
  PLATFORM_ADMIN: "platform_admin",
  DEMO: "demo",
} as const;

export const ADMIN_ROLES = [
  "org_admin",
  "platform_admin",
  "demo",
] as const;

// Legacy aliases that normalize to one of the ADMIN_ROLES.
export const ADMIN_ALIASES = [
  "admin",
  "administrator",
  "institution_admin",
  "platform_admin",
  "principal",
  "coordinator",
  "course_coordinator",
] as const;

export const ALL_ADMIN_ROLES = [...ADMIN_ROLES, ...ADMIN_ALIASES] as readonly string[];

// Org-level admin roles (institution head / coordinator).
export const PRINCIPAL_ROLES = ["org_admin", "principal", "institution_admin", "coordinator", "course_coordinator"] as const;

export const STAFF_ROLES = [
  "instructor",
  "org_admin",
  "platform_admin",
  "demo",
] as const;

// Legacy aliases that normalize to a STAFF_ROLE.
export const STAFF_ALIASES = [
  "coordinator",
  "course_coordinator",
  "principal",
  "institution_admin",
  "administrator",
  "platform_admin",
  "admin",
  "teacher",
  "teaching_assistant",
] as const;

export function normalizeRole(role: string): string | null {
  const r = role?.toLowerCase();
  switch (r) {
    case "learner":
    case "student":
    case "pending":
    case "counselor":
    case "guardian":
      return UserRole.LEARNER;
    case "instructor":
    case "teacher":
    case "teaching_assistant":
      return UserRole.INSTRUCTOR;
    case "org_admin":
    case "coordinator":
    case "course_coordinator":
    case "principal":
    case "institution_admin":
    case "institution administrator":
      return UserRole.ORG_ADMIN;
    case "platform_admin":
    case "platform administrator":
    case "administrator":
    case "admin":
      return UserRole.PLATFORM_ADMIN;
    case "demo":
      return UserRole.DEMO;
    default: return null;
  }
}

export function hasAdminRole(role: string): boolean {
  return ALL_ADMIN_ROLES.includes(role);
}

export function hasPrincipalRole(role: string): boolean {
  const n = normalizeRole(role);
  return n === UserRole.ORG_ADMIN || n === UserRole.PLATFORM_ADMIN;
}

export function isStaffRole(role: string): boolean {
  const n = normalizeRole(role);
  if (!n) return false;
  return (STAFF_ROLES as readonly string[]).includes(n);
}

export function canSeeAuditTab(role: string): boolean {
  return hasAdminRole(role) || normalizeRole(role) === UserRole.PLATFORM_ADMIN;
}
