import type { Metadata } from "next";
import { V3ReviewQueue } from "@/modules/ui-v3";

/**
 * /instructor/review — I3 Review queue (REDESIGN-P3 §I3, W4 review side).
 * P1c.19: full v3 restyle. Same /api/v2/review/queue endpoint.
 */

export const metadata: Metadata = {
  title: "Review queue — TraineesAI",
};

export default function InstructorReviewPage() {
  return <V3ReviewQueue />;
}
