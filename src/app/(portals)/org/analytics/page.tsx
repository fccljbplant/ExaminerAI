import type { Metadata } from "next";
import { OrgAnalytics } from "@/modules/org-portal";

/**
 * /org/analytics — O7 Study Analytics (REDESIGN-P3 §O7, W7).
 */

export const metadata: Metadata = {
  title: "Study analytics — TraineesAI",
};

export default function OrgAnalyticsPage() {
  return <OrgAnalytics />;
}
