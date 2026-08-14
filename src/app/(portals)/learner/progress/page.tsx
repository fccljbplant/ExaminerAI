import type { Metadata } from "next";
import { LearnerProgress } from "@/modules/learner-portal";

/**
 * /learner/progress — L11 Progress (REDESIGN-P3 §L11).
 */

export const metadata: Metadata = {
  title: "Progress — TraineesAI",
};

export default function LearnerProgressPage() {
  return <LearnerProgress />;
}
