import type { Metadata } from "next";
import { PlatformUsers } from "@/modules/platform-portal";

/** /platform/users — full user management (W11 audit: V1 Users tab). */

export const metadata: Metadata = { title: "Users — TraineesAI" };

export default function PlatformUsersPage() {
  return <PlatformUsers />;
}
