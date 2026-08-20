import type { Metadata } from "next";
import { ProjectWorkspace } from "@/modules/learner-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /learner/projects/[id] — L7 Project workspace (REDESIGN-P3 §L7, W10
 * audit: V1 project panels re-homed). Guards live in the portal layout.
 *
 * P1c.15: v3 wrapper around v2 ProjectWorkspace (938 lines — too complex
 * to fully restyle in P1c).
 */

export const metadata: Metadata = {
  title: "Project — TraineesAI",
};

export default async function LearnerProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <V3Wrapper
      title="Project workspace"
      subtitle="Capstone project — milestones, tasks, deliverables, and mentor feedback."
    >
      <ProjectWorkspace projectId={id} />
    </V3Wrapper>
  );
}
