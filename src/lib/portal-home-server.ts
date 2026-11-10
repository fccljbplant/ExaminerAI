/**
 * Server-only role-home resolver. Keep routing aligned with the same
 * rollout flags enforced by each portal layout so users are not sent
 * through a disabled portal before falling back to /learn.
 *
 * Database/flag modules are loaded only when a real lookup is required;
 * tests and callers with explicit flag snapshots can exercise routing
 * without booting Prisma.
 */
import { homeForRole } from "./portal-home";

export interface RoleHomeFlags {
  learner?: boolean;
  instructor?: boolean;
  org?: boolean;
  platform?: boolean;
}

export async function resolveHomeForUser(
  user: { role: string; sub?: string },
  flags?: RoleHomeFlags,
): Promise<string> {
  const role = user.role === "admin" ? "platform_admin" : user.role;

  if (role === "platform_admin") {
    const enabled = flags?.platform ?? (await import("../modules/platform-portal/lib/flag")).isPlatformPortalEnabled();
    return enabled ? "/platform" : "/learn";
  }
  if (role === "org_admin") {
    const enabled = flags?.org ?? (await import("../modules/org-portal/lib/flag")).isOrgPortalEnabled();
    return enabled ? "/org" : "/learn";
  }
  if (role === "instructor" || role === "learner" || role === "student") {
    const portal = role === "instructor" ? "instructor" : "learner";
    const override = portal === "instructor" ? flags?.instructor : flags?.learner;
    let enabled = override;

    if (enabled === undefined) {
      // Match the org-specific rollout override used by learner/instructor layout¶»§q«^