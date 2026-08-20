import type { Metadata } from "next";
import { V3LearnerExams } from "@/modules/ui-v3";

/**
 * /learner/exams — L8 Exams hub (REDESIGN-P3 §L8).
 * P1b.13: v3-styled. Same flow — links to practice / daily / weekly tests.
 */

export const metadata: Metadata = {
  title: "Exams — TraineesAI",
};

export default function LearnerExamsPage() {
  return <V3LearnerExams />;
}
