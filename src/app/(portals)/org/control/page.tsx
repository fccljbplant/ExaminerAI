import type { Metadata } from "next";
import { OrgControl } from "@/modules/org-portal";

/**
 * /org/control — O4 Control Center (REDESIGN-P3 §O4, W7).
 */

export const metadata: Metadata = {
  title: "Control center — TraineesAI",
};

export default function OrgControlPage() {
  return <OrgControl />;
}
