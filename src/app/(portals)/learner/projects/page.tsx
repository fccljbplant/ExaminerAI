import type { Metadata } from "next";
import { LearnerProjects } from "@/modules/learner-portal";

/**
 * /learner/projects — project list + new-proposal form (v2 project flow
 * entry point). New projects start as pending_approval; the workspace
 * (/learner/projects/[id]) handles approval → timeline → weekly tasks.
 */

export const metadata: Metadata = {
  title: "Projects — TraineesAI",
};

export default function LearnerProjectsPage() {
  return <LearnerProjects />;
}
