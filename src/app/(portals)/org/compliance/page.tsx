import type { Metadata } from "next";
import { OrgCompliance } from "@/modules/org-portal";

/**
 * /org/compliance — assignment-expiry compliance matrix (B2B ops, 2026-08-17).
 */

export const metadata: Metadata = {
  title: "Compliance — TraineesAI",
};

export default function OrgCompliancePage() {
  return <OrgCompliance />;
}
