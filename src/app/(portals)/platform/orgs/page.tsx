import type { Metadata } from "next";
import { V3PlatformTenants } from "@/modules/ui-v3";

/** /platform/orgs — SaaS Tenants (2026-08-17). P3.17b: full v3 restyle. */

export const metadata: Metadata = {
  title: "Tenants — TraineesAI",
};

export default function TenantsPage() {
  return <V3PlatformTenants />;
}
