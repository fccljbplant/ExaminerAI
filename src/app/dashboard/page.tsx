import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveHomeForUser } from "@/lib/portal-home-server";

/**
 * /dashboard → role-aware home (2026-08-18, fix/ui-simplification-safe)
 *
 * Previously always redirected to /learn. Now resolves the signed-in
 * user's role + portal flags: learner → /learner (or /learn when the
 * learner portal is disabled), instructor → /instructor, org_admin →
 * /org, platform_admin → /platform. Unauthenticated → /login.
 */
export default async function DashboardRedirect(): Promise<never> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  redirect(await resolveHomeForUser(user));
}
