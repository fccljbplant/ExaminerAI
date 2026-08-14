import type { Metadata } from "next";
import { InstructorAnalytics } from "@/modules/instructor-portal";

/**
 * /instructor/analytics — I8 Analytics (REDESIGN-P3 §I8, W6).
 */

export const metadata: Metadata = {
  title: "Analytics — TraineesAI",
};

export default function InstructorAnalyticsPage() {
  return <InstructorAnalytics />;
}
