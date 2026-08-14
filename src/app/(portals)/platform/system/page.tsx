import type { Metadata } from "next";
import { PlatformSystem } from "@/modules/platform-portal";

/**
 * /platform/system — P3 System health (V1 SystemPanel re-homed).
 */

export const metadata: Metadata = {
  title: "System — TraineesAI",
};

export default function PlatformSystemPage() {
  return <PlatformSystem />;
}
