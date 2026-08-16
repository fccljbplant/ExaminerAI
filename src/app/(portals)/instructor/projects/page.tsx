import type { Metadata } from "next";
import { ProjectQueue } from "@/modules/instructor-portal";

/**
 * /instructor/projects — project approval queue (v2 project flow).
 * Learner proposals land here as pending_approval; task generation stays
 * locked until an instructor approves them.
 */

export const metadata: Metadata = {
  title: "Projects — TraineesAI",
};

export default function InstructorProjectsPage() {
  return <ProjectQueue />;
}
