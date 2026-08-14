import type { Metadata } from "next";
import { OrgHome } from "@/modules/org-portal";

/**
 * /org — O1 Command Center (REDESIGN-P3 §O1, W7).
 */

export const metadata: Metadata = {
  title: "Org home — TraineesAI",
};

export default function OrgHomePage() {
  return <OrgHome />;
}
