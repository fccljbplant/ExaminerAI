import type { Metadata } from "next";
import { ReviewQueue } from "@/modules/instructor-portal";

/**
 * /instructor/review — I3 Review queue (REDESIGN-P3 §I3, W4 review side).
 * Auth / role / flag guards live in the route-group layout.
 */

export const metadata: Metadata = {
  title: "Review queue — TraineesAI",
};

export default function InstructorReviewPage() {
  return <ReviewQueue />;
}
