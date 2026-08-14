import type { Metadata } from "next";
import { OrgPeople } from "@/modules/org-portal";

/**
 * /org/people — O2 People & Roles (REDESIGN-P3 §O2, W7).
 */

export const metadata: Metadata = {
  title: "People — TraineesAI",
};

export default function OrgPeoplePage() {
  return <OrgPeople />;
}
