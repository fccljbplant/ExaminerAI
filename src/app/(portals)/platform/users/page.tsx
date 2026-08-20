import type { Metadata } from "next";
import { PlatformUsers } from "@/modules/platform-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/** /platform/users — full user management (W11 audit: V1 Users tab).
 *  P1c.17: v3 wrapper around v2 PlatformUsers (387 lines). */

export const metadata: Metadata = { title: "Users — TraineesAI" };

export default function PlatformUsersPage() {
  return (
    <V3Wrapper
      title="Users"
      subtitle="All user accounts on the platform — search, filter by role, manage status."
    >
      <PlatformUsers />
    </V3Wrapper>
  );
}
