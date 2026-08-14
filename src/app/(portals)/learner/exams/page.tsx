import type { Metadata } from "next";
import { LearnerExams } from "@/modules/learner-portal";

/**
 * /learner/exams — L8 Exams schedule (REDESIGN-P3 §L8).
 */

export const metadata: Metadata = {
  title: "Exams — TraineesAI",
};

export default function LearnerExamsPage() {
  return <LearnerExams />;
}
