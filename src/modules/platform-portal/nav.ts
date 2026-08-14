/**
 * modules/platform-portal/nav.ts — portal navigation constants
 * (plain TS — see W6 lesson on the RSC boundary).
 */

import { Building2, Cpu, Home, LayoutDashboard, Server } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Platform admin: desktop-dense portal; mobile = alerts + approvals (P3 §4). */
export const PLATFORM_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/platform", icon: Home },
  { id: "audit", label: "Audit", href: "/platform/audit", icon: LayoutDashboard, match: ["/platform/audit"] },
  { id: "ai", label: "AI", href: "/platform/ai", icon: Cpu, match: ["/platform/ai"] },
  { id: "system", label: "System", href: "/platform/system", icon: Server, match: ["/platform/system"] },
];

export const PLATFORM_MORE: NavItem[] = [];
