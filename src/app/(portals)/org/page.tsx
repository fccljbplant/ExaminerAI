import type { Metadata } from "next";
import { V3OrgHomeContent } from "@/modules/ui-v3";

/**
 * /org — O1 Command Center (REDESIGN-P3 §O1, W7).
 */

export const metadata: Metadata = {
  title: "Org home — TraineesAI",
};

export default function OrgHomePage() {
  return <V3OrgHomeContent />;
}
