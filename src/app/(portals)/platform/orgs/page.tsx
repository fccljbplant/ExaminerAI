import type { Metadata } from "next";
import { PlatformTenants } from "@/modules/platform-portal/tenants";
import { V3Wrapper } from "@/modules/ui-v3";

/** /platform/orgs — SaaS Tenants (2026-08-17). P1c.17: v3 wrapper. */

export const metadata: Metadata = {
  title: "Tenants — TraineesAI",
};

export default function TenantsPage() {
  return (
    <V3Wrapper
      title="Organizations"
      subtitle="All tenants on the platform — seats, plan, members, MRR."
    >
      <PlatformTenants />
    </V3Wrapper>
  );
}
