import type { Metadata } from "next";
import { V3LearnerProgress } from "@/modules/ui-v3";

/**
 * /learner/progress — L11 Progress (REDESIGN-P3 §L11).
 * P1b.12: v3-styled. Same /api/v2/learner/progress endpoint.
 */

export const metadata: Metadata = {
  title: "Progress — TraineesAI",
};

export default function LearnerProgressPage() {
  return <V3LearnerProgress />;
}
