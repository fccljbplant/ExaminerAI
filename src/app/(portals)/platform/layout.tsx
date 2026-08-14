import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/portal-home";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { PlatformShell } from "@/modules/platform-portal";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

/**
 * /platform/* — platform admin portal v2 (REDESIGN-P5 W7, flag portal_platform_v2).
 *
 * Guards: authenticated → platform_admin (legacy "admin" admitted) →
 * flag ON.
 */

export default async function PlatformPortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "platform_admin" && user.role !== "admin") redirect(homeForRole(user.role));

  if (!(await isPlatformPortalEnabled())) redirect("/app");

  return <PlatformShell userName={user.name}>{children}</PlatformShell>;
}
