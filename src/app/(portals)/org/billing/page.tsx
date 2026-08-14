import type { Metadata } from "next";
import { OrgBilling } from "@/modules/org-portal";

/**
 * /org/billing — O6 Billing & seats (REDESIGN-P3 §O6, W7).
 */

export const metadata: Metadata = {
  title: "Billing — TraineesAI",
};

export default function OrgBillingPage() {
  return <OrgBilling />;
}
