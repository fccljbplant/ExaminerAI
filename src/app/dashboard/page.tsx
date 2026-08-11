import { redirect } from "next/navigation";

/**
 * /dashboard → /learn
 *
 * The learner's home is now /learn (AI-guided learning experience).
 * The old /app dashboard still exists for admin/instructor/B2B flows.
 */
export default function DashboardRedirect(): never {
  redirect("/learn");
}
