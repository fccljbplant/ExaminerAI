import type { Metadata } from "next";
import { StudentsRoster } from "@/modules/instructor-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /instructor/students — I5 Students roster (REDESIGN-P3 §I5, W6).
 * P1c.18: v3 wrapper around v2 StudentsRoster.
 */

export const metadata: Metadata = {
  title: "Students — TraineesAI",
};

export default function InstructorStudentsPage() {
  return (
    <V3Wrapper
      title="Students"
      subtitle="Roster of learners across all courses you teach. Click any student for a drill-down."
    >
      <StudentsRoster />
    </V3Wrapper>
  );
}
