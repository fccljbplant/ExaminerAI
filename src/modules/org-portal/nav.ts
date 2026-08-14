/**
 * modules/org-portal/nav.ts — portal navigation constants
 *
 * Plain TS (NO "use client") so both the client shell and server
 * pages can import the same arrays (see W6 lesson: client-module
 * exports can't cross the RSC boundary).
 */

import {
  BarChart3,
  Building2,
  Home,
  LayoutDashboard,
  MoreHorizontal,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Bottom tabs: Home / People / Control / Reports / More (5 slots). */
export const ORG_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/org", icon: Home },
  { id: "people", label: "People", href: "/org/people", icon: Users },
  { id: "control", label: "Control", href: "/org/control", icon: ShieldCheck },
  { id: "reports", label: "Reports", href: "/org/audit", icon: LayoutDashboard },
  { id: "more", label: "More", href: "/org/more", icon: MoreHorizontal },
];

/** Secondary destinations for the More hub (O3/O6/O7). */
export const ORG_MORE: NavItem[] = [
  { id: "registries", label: "Registries", href: "/org/registries", icon: ServerCog },
  { id: "analytics", label: "Study analytics", href: "/org/analytics", icon: BarChart3 },
  { id: "billing", label: "Billing & seats", href: "/org/billing", icon: Building2 },
];
