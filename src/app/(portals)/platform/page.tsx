import type { Metadata } from "next";
import { V3PlatformHomeContent } from "@/modules/ui-v3";

/**
 * /platform — P1 Platform home (REDESIGN-P3 §P1, W7).
 */

export const metadata: Metadata = {
  title: "Platform — TraineesAI",
};

export default function PlatformHomePage() {
  return <V3PlatformHomeContent />;
}
