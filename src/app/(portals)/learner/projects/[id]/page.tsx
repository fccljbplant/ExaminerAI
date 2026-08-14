import type { Metadata } from "next";
import { ProjectWorkspace } from "@/modules/learner-portal";

/**
 * /learner/projects/[id] — L7 Project workspace (REDESIGN-P3 §L7, W10
 * audit: V1 project panels re-homed). Guards live in the portal layout.
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
  return <ProjectWorkspace projectId={id} />;
}
