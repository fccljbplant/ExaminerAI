import type { Metadata } from "next";
import { PlatformRevenue } from "@/modules/platform-portal/revenue";

/** /platform/revenue — SaaS P&L (2026-08-17). Guards live in the layout. */

export const metadata: Metadata = {
  title: "Revenue — TraineesAI",
};

export default function RevenuePage() {
  return <PlatformRevenue />;
}
