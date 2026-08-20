import type { Metadata } from "next";
import { OrgPeople } from "@/modules/org-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /org/people — O2 People & Roles (REDESIGN-P3 §O2, W7).
 * P1c.16: v3 wrapper around v2 OrgPeople (598 lines with CSV import,
 * department sidebar, role badges, seat chips, deactivate-with-undo).
 */

export const metadata: Metadata = {
  title: "People — TraineesAI",
};

export default function OrgPeoplePage() {
  return (
    <V3Wrapper
      title="People & roles"
      subtitle="Manage members, seats, departments, and invitations."
    >
      <OrgPeople />
    </V3Wrapper>
  );
}
