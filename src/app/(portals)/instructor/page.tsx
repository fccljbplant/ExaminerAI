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
}
