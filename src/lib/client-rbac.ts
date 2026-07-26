/**
 * Client-side role helpers — mirrors src/lib/rbac.ts for use in components.
 *
 * Import this instead of raw string arrays like
 *   ["administrator", "admin", "platform_admin"].includes(role)
 * which bypasses the centralized role definitions and is prone to drift.
 */

// Canonical admin roles (must match rbac.ts ADMIN_ROLES)
export const ADMIN_ROLES = [
  "principal",
  "administrator",
  "demo",
] as const;

// Legacy aliases that normalize to admin roles
export const ADMIN_ALIASES = [
  "admin",
  "institution_admin",
  "platform_admin",
] as const;

// All roles that count as "admin equivalent" (canonical + aliases)
export const ALL_ADMIN_ROLES = [...ADMIN_ROLES, ...ADMIN_ALIASES] as readonly string[];

// Principal-only roles (for safeguarding, audit log visibility)
export const PRINCIPAL_ROLES = ["principal", "institution_admin"] as const;

// Staff roles (must match rbac.ts STAFF_ROLES)
export const STAFF_ROLES = [
  "teaching_assistant",
  "teacher",
  "course_coordinator",
  "counselor",
  "principal",
  "administrator",
  "demo",
] as const;

/** Check if a role is an admin role (canonical or legacy alias). */
export function hasAdminRole(role: string): boolean {
  return ALL_ADMIN_ROLES.includes(role);
}

/** Check if a role is a principal-level role (institution head). */
export function hasPrincipalRole(role: string): boolean {
  return (PRINCIPAL_ROLES as readonly string[]).includes(role) || role === "administrator" || role === "platform_admin" || role === "admin";
}

/** Check if a role is a staff role (non-student, non-guardian). */
export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as any) || ADMIN_ALIASES.includes(role as any);
}

/** Check if a role should see the audit tab on student portfolios. */
export function canSeeAuditTab(role: string): boolean {
  return ALL_ADMIN_ROLES.includes(role);
}
