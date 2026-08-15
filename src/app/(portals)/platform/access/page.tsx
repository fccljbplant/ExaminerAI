import type { Metadata } from "next";
import { PlatformAccess } from "@/modules/platform-portal";

/** /platform/access — access grants (W16: V1 AccessGrantsPanel). */

export const metadata: Metadata = { title: "Access grants — TraineesAI" };

export default function PlatformAccessPage() {
  return <PlatformAccess />;
}
