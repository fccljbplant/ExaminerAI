/**
 * modules/org-portal/nav.ts — portal navigation constants
 *
 * Plain TS (NO "use client") so both the client shell and server
 * pages can import the same arrays (see W6 lesson: client-module
 * exports can't cross the RSC boundary).
 */

import {
  Building2,
  Home,
  LayoutDashboard,
  MoreHorizontal,
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

/** Secondary destinations for the More hub (billing/analytics land later). */
export const ORG_MORE: NavItem[] = [
  { id: "billing", label: "Billing & seats", href: "/org/more", icon: Building2 },
];
