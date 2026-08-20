import type { Metadata } from "next";
import { StudentProfile } from "@/modules/instructor-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /instructor/students/[studentId] — I6 Student drill-down
 * (REDESIGN-P3 §I6, W10 rebuild). P1c.18: v3 wrapper around v2
 * StudentProfile (1,371 lines — largest component in the codebase.
 * Full restyle deferred to P2 polish).
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
  return (
    <V3Wrapper
      title="Student profile"
      subtitle="Drill-down: enrollment, progress, at-risk flags, recent activity, and direct contact."
    >
      <StudentProfile studentId={studentId} />
    </V3Wrapper>
  );
}
