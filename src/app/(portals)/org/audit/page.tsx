import type { Metadata } from "next";
import { OrgAudit } from "@/modules/org-portal";

/**
 * /org/audit — O5 Monitoring & Audit (REDESIGN-P3 §O5, W7) — Reports tab.
 */

export const metadata: Metadata = {
  title: "Audit — TraineesAI",
};

export default function OrgAuditPage() {
  return <OrgAudit />;
}
