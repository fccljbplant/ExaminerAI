import type { Metadata } from "next";
import { V3OrgPeople } from "@/modules/ui-v3";

/**
 * /org/people — O2 People & Roles (REDESIGN-P3 §O2, W7).
 * P4.16d: full v3 restyle.
 */

export const metadata: Metadata = {
  title: "People — TraineesAI",
};

export default function OrgPeoplePage() {
  return <V3OrgPeople />;
}
