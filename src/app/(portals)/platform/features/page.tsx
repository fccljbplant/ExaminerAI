import type { Metadata } from "next";
import { PlatformFeatures } from "@/modules/platform-portal";

/** /platform/features — global feature toggles (W11 audit: V1 FeaturesPanel). */

export const metadata: Metadata = { title: "Features — TraineesAI" };

export default function PlatformFeaturesPage() {
  return <PlatformFeatures />;
}
