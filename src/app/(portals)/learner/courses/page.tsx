import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /learner/courses — compatibility alias for the learner course catalog.
 * The canonical catalog is /learner/learn (REDESIGN-P3 §L2).
 * The parent learner layout continues to enforce authentication, role and
 * portal rollout checks before this redirect is reached.
 */
export const metadata: Metadata = {
  title: "Courses — TraineesAI",
};

export default function LearnerCoursesAliasPage() {
  redirect("/learner/learn");
}
