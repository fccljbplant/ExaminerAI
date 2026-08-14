import type { Metadata } from "next";
import { PlatformResets } from "@/modules/platform-portal";

/** /platform/resets — password reset approvals (W11 audit: V1 PasswordResetPanel). */

export const metadata: Metadata = { title: "Password resets — TraineesAI" };

export default function PlatformResetsPage() {
  return <PlatformResets />;
}
