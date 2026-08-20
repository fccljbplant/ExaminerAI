import type { Metadata } from "next";
import { OrgControl } from "@/modules/org-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/**
 * /org/control — O4 Control Center (REDESIGN-P3 §O4, W7).
 * P1c.16: v3 wrapper around v2 OrgControl (534 lines with brand-color
 * picker, logo upload, public storefront settings).
 */

export const metadata: Metadata = {
  title: "Control center — TraineesAI",
};

export default function OrgControlPage() {
  return (
    <V3Wrapper
      title="Control center"
      subtitle="Branding (brand color, logo, theme), organization profile, and storefront settings."
    >
      <OrgControl />
    </V3Wrapper>
  );
}
