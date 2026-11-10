/**
 * src/lib/portal-home.ts — W10 cutover helper (CLIENT-SAFE, pure)
 *
 * Role → v2 portal home. The legacy /app shell is deleted; every
 * post-auth redirect (login form, public home, portal layouts) routes
 * through this single mapping so a wrong-role visit lands on the
 * user's own portal instead of a dead /app link.
 *
 * IMPORTANT: this module must stay free of server-only imports — the
 * client login form imports it. The async, feature-flag-aware variant
 * lives in src/lib/portal-home-server.ts (server components only).
 */

/** Sync role → home. Unknown roles fall back to /learn. */
export function homeForRole(role: string): string {
  if (role === "instructor") return "/instructor";
  if (role === "org_admin") return "/org";
  if (role === "platform_admin" || role === "admin") return "/platform";
  if (role === "learner" || role === "student" || role === "demo") return "/learner";
  return "/learn";
}
