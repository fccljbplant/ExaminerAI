import type { Metadata } from "next";
import { LearnerCatalog } from "@/modules/learner-portal";

/**
 * /learner/learn — L2 Catalog (REDESIGN-P3 §L2), root of the Learn tab.
 */

export const metadata: Metadata = {
  title: "Courses — TraineesAI",
};

export default function LearnerLearnPage() {
  return <LearnerCatalog />;
}
