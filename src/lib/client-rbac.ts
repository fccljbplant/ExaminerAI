/**
 * Client-side role helpers — mirrors src/lib/rbac.ts for use in components.
 */

export const ADMIN_ROLES = [
  "principal",
  "administrator",
  "demo",
] as const;

export const ADMIN_ALIASES = [
  "admin",
  "institution_admin",
  "platform_admin",
] as const;

export const ALL_ADMIN_ROLES = [...ADMIN_ROLES, ...ADMIN_ALIASES] as readonly string[];

export const PRINCIPAL_ROLES = ["principal", "institution_admin"] as const;

export const STAFF_ROLES = [
  "instructor",
  "coordinator",
  "counselor",
  "principal",
  "administrator",
  "demo",
] as const;

export function hasAdminRole(role: string): boolean {
  return ALL_ADMIN_ROLES.includes(role);
}

export function hasPrincipalRole(role: string): boolean {
  return (PRINCIPAL_ROLES as readonly string[]).includes(role) || role === "administrator" || role === "platform_admin" || role === "admin";
}

export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as any) || ADMIN_ALIASES.includes(role as any);
}

export function canSeeAuditTab(role: string): boolean {
  return ALL_ADMIN_ROLES.includes(role);
}