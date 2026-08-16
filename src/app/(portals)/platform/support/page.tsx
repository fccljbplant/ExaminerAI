import type { Metadata } from "next";
import { PlatformSupport } from "@/modules/platform-portal/support";

/** /platform/support — SaaS support tools (2026-08-17). */

export const metadata: Metadata = {
  title: "Support — TraineesAI",
};

export default function SupportPage() {
  return <PlatformSupport />;
}
