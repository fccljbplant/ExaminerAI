import type { Metadata } from "next";
import { InstructorAssignments } from "@/modules/instructor-portal";

/**
 * /instructor/courses — Assignments & Events studio (W11 audit: V1
 * AssignmentsTab restored — group task CRUD + class calendar).
 */

export const metadata: Metadata = {
  title: "Courses & assignments — TraineesAI",
};

export default function InstructorCoursesPage() {
  return <InstructorAssignments />;
}
