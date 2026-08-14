import type { Metadata } from "next";
import { PlatformHome } from "@/modules/platform-portal";

/**
 * /platform — P1 Platform home (REDESIGN-P3 §P1, W7).
 */

export const metadata: Metadata = {
  title: "Platform — TraineesAI",
};

export default function PlatformHomePage() {
  return <PlatformHome />;
}
