import type { Metadata } from "next";
import { PlatformB2C } from "@/modules/platform-portal";

/** /platform/b2c — independent learners (W16: V1 B2CPanel). */

export const metadata: Metadata = { title: "Independent learners — TraineesAI" };

export default function PlatformB2CPage() {
  return <PlatformB2C />;
}
