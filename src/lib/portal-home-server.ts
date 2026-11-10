/**
 * src/lib/portal-home-server.ts — async, feature-flag-aware home
 * resolution for SERVER COMPONENTS (2026-08-18,
 * fix/ui-simplification-safe).
 *
 * /dashboard, the public home and the public layout use this so a
 * disabled learner portal routes learners to /learn without the
 * one-bounce through /learner. Flag lookups fail OPEN (→ role home) so
 * a transient DB hiccup never strands the user; the portal layouts
 * stay the authority and fail closed.
 *
 * IMPORTANT: server-only — never import from client components.
 */

import { isPortalEnabled } from "./feature-flags";
import { homeForRole } from "./portal-home";

export interface RoleHomeFlags {
  learner?: boolean;
  instructor?: boolean;
  org?: boolean;
}

export async function resolveHomeForUser(
  user: { role: string },
  flags?: RoleHomeFlags,
): Promise<string> {
  const role = user.role === "admin" ? "platform_admin" : user.role;
  if (role === "platform_admin") return "/platform";
  if (role === "org_admin") {
    const enabled = flags?.org ?? (await isPortalEnabled("org").catch(() => true));
    return enabled ? "/org" : "/learn";
  }
  if (role === "instructor") {
    const enabled = flags?.instructor ?? (await isPortalEnabled("instructor").catch(() => true));
    return enabled ? "/instructor" : "/learn";
  }
  if (role === "learner" || role === "student" || role === "demo") {
    const enabled = flags?.learner ?? (await isPortalEnabled("learner").catch(() => true));
    return enabled ? "/learner" : "/learn";
  }
  // Unknown role → safe fallback.
  return homeForRole(role);
}
