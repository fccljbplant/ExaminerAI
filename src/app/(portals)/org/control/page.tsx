import type { Metadata } from "next";
import { V3OrgControl } from "@/modules/ui-v3";

/**
 * /org/control — O4 Control Center (REDESIGN-P3 §O4, W7).
 * P4.16c: full v3 restyle.
 */

export const metadata: Metadata = {
  title: "Control center — TraineesAI",
};

export default function OrgControlPage() {
  return <V3OrgControl />;
}
