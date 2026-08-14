import type { Metadata } from "next";
import { StudentsRoster } from "@/modules/instructor-portal";

/**
 * /instructor/students — I5 Students roster (REDESIGN-P3 §I5, W6).
 */

export const metadata: Metadata = {
  title: "Students — TraineesAI",
};

export default function InstructorStudentsPage() {
  return <StudentsRoster />;
}
