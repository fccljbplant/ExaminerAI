import type { Metadata } from "next";
import { LearnerHome } from "@/modules/learner-portal";

/**
 * /learner — L1 Home (REDESIGN-P3 §L1).
 * Auth / role / portal-flag guards live in the route-group layout.
 */

export const metadata: Metadata = {
  title: "Home — TraineesAI",
};

export default function LearnerHomePage() {
  return <LearnerHome />;
}
