/**
 * modules/platform-portal/nav.ts — portal navigation constants
 * (plain TS — see W6 lesson on the RSC boundary).
 */

import { Building2, Home, LayoutDashboard, Server } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Platform admin: desktop-dense portal; mobile = alerts + approvals (P3 §4). */
export const PLATFORM_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/platform", icon: Home },
  { id: "orgs", label: "Orgs", href: "/platform", icon: Building2 },
  { id: "audit", label: "Audit", href: "/platform/audit", icon: LayoutDashboard },
  { id: "system", label: "System", href: "/platform", icon: Server },
];

export const PLATFORM_MORE: NavItem[] = [];
