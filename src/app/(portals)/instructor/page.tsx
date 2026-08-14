<<<<<<< HEAD
import type { Metadata } from "next";
import { InstructorHome } from "@/modules/instructor-portal";

/**
 * /instructor — I1 Instructor home (REDESIGN-P3 §I1, W6).
 * Auth / role / flag guards live in the route-group layout.
 */

export const metadata: Metadata = {
  title: "Instructor home — TraineesAI",
};

export default function InstructorHomePage() {
  return <InstructorHome />;
=======
import { redirect } from "next/navigation";

/**
 * /instructor — portal root. The review center is the instructor home
 * for W4; the full dashboard lands with W6.
 */

export default function InstructorRootPage() {
  redirect("/instructor/review");
>>>>>>> 7083773 (feat: enable portal v2 flags — learner + instructor dashboards accessible)
}
