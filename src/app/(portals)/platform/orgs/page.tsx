import type { Metadata } from "next";
import { PlatformTenants } from "@/modules/platform-portal/tenants";

/** /platform/orgs — SaaS Tenants (2026-08-17). Guards live in the layout. */

export const metadata: Metadata = {
  title: "Tenants — TraineesAI",
};

export default function TenantsPage() {
  return <PlatformTenants />;
}
