import type { Metadata } from "next";
import { V3CoursesCatalog } from "@/modules/ui-v3";

/**
 * /learner/learn — L2 Catalog (REDESIGN-P3 §L2), root of the Learn tab.
 * Always renders the v3-styled catalog (matches the uploaded test.html
 * reference design).
 */

export const metadata: Metadata = {
  title: "Courses — TraineesAI",
};

export default function LearnerLearnPage() {
  return <V3CoursesCatalog />;
}
