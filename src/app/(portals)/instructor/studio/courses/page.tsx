import type { Metadata } from "next";
import { CoursePlanner } from "@/modules/platform-portal/course-planner";

/**
 * /instructor/studio/courses — creator course list (2026-08-17).
 *
 * Reuses the platform CoursePlanner with ownership badges ("Yours")
 * for the courses this instructor owns.
 */

export const metadata: Metadata = {
  title: "Studio courses — TraineesAI",
};

export default function InstructorStudioCoursesPage() {
  return <CoursePlanner showOwnership />;
}
