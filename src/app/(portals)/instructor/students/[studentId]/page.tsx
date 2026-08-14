import type { Metadata } from "next";
import { StudentProfile } from "@/modules/instructor-portal";

/**
 * /instructor/students/[studentId] — I6 Student drill-down
 * (REDESIGN-P3 §I6, W10 rebuild). Auth / role / flag in the layout;
 * IDOR + data in the v2 aggregate route.
 */

export const metadata: Metadata = {
  title: "Student — TraineesAI",
};

export default async function InstructorStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} />;
}
