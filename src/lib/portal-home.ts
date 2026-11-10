/**
 * src/lib/portal-home.ts — W10 cutover helper
 *
 * Role → v2 portal home. The legacy /app shell is deleted; every
 * post-auth redirect (login form, public home, portal layouts) routes
 * through this single mapping so a wrong-role visit lands on the
 * user's own portal instead of a dead /app link.
 */

export function homeForRole(role: string): string {
  if (role === "instructor") return "/instructor";
  if (role === "org_admin") return "/org";
  if (role === "platform_admin" || role === "admin") return "/platform";
  return "/learner"; // learner | student | demo | fallback
}
