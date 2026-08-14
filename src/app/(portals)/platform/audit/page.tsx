import type { Metadata } from "next";
import { PlatformAudit } from "@/modules/platform-portal";

/**
 * /platform/audit — P6 Global audit (REDESIGN-P3 §P6, W7).
 */

export const metadata: Metadata = {
  title: "Audit — TraineesAI",
};

export default function PlatformAuditPage() {
  return <PlatformAudit />;
}
