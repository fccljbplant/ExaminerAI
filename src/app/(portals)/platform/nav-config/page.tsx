import type { Metadata } from "next";
import { PlatformNavConfig } from "@/modules/platform-portal";

/** /platform/nav-config — per-role nav assignment (W16: V1 RoleNavConfigPanel). */

export const metadata: Metadata = { title: "Nav config — TraineesAI" };

export default function PlatformNavConfigPage() {
  return <PlatformNavConfig />;
}
