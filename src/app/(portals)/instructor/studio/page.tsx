"use client";

import { useRouter } from "next/navigation";
import { CourseCreationWizard } from "@/modules/platform-portal/course-wizard";

/**
 * /instructor/studio — creator-economy course studio (2026-08-17).
 *
 * Reuses the platform CourseCreationWizard. Drafts route to the studio
 * course list (/instructor/studio/courses) so creators can publish later.
 * Client page: the wizard needs router-backed back/created handlers.
 */

export default function InstructorStudioPage() {
  const router = useRouter();

  return (
    <CourseCreationWizard
      draftRedirect="/instructor/studio/courses"
      onBack={() => router.push("/instructor/studio/courses")}
      onCreated={() => router.push("/instructor/studio/courses")}
    />
  );
}
