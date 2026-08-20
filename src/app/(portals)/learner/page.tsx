import type { Metadata } from "next";
import { V3LearnerHomeContent } from "@/modules/ui-v3";

/**
 * /learner — L1 Home (REDESIGN-P3 §L1).
 * Auth / role / portal-flag guards live in the route-group layout.
 * Always renders the v3-styled dashboard content (matches the uploaded
 * test.html reference design — dark sidebar chrome is provided by the
 * layout's V3Shell).
 */

export const metadata: Metadata = {
  title: "Home — TraineesAI",
};

export default function LearnerHomePage() {
  return <V3LearnerHomeContent />;
}
