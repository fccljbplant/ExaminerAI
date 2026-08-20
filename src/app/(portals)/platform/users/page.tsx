import type { Metadata } from "next";
import { V3PlatformUsers } from "@/modules/ui-v3";

/** /platform/users — full user management (W11 audit: V1 Users tab).
 *  P3.17a: full v3 restyle. Same /api/users endpoints. */

export const metadata: Metadata = { title: "Users — TraineesAI" };

export default function PlatformUsersPage() {
  return <V3PlatformUsers />;
}
