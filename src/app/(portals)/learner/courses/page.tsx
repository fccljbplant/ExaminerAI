import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /learner/courses — My Learning (enrolled courses list).
 *
 * Audit finding §1.3.1 (item 8): the v3 sidebar's "My Learning"
 * nav item linked here, but no page.tsx existed — would 404.
 *
 * P0 fix: route exists now. It redirects to the v3 Courses catalog
 * (/learner/learn), which already shows enrolled courses pinned at
 * the top (the API returns enrolled courses first). P1 will introduce
 * a dedicated "My Learning" view that shows ONLY enrolled courses with
 * progress + Continue buttons — that lives outside P0's scope.
 */

export const metadata: Metadata = {
  title: "My Learning — TraineesAI",
};

export default function LearnerMyCoursesPage() {
  redirect("/learner/learn");
}
