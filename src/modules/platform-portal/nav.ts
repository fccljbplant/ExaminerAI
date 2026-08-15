/**
 * modules/platform-portal/nav.ts — portal navigation constants
 * (plain TS — see W6 lesson on the RSC boundary).
 */

import { BookOpen, Building2, Cpu, Home, KeyRound, LayoutDashboard, Server, ShieldCheck, SlidersHorizontal, UserRound, Users } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Platform admin: desktop-dense portal; mobile = alerts + approvals (P3 §4). */
export const PLATFORM_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/platform", icon: Home },
  { id: "users", label: "Users", href: "/platform/users", icon: Users, match: ["/platform/users"] },
  { id: "audit", label: "Audit", href: "/platform/audit", icon: LayoutDashboard, match: ["/platform/audit"] },
  { id: "ai", label: "AI", href: "/platform/ai", icon: Cpu, match: ["/platform/ai"] },
  { id: "system", label: "System", href: "/platform/system", icon: Server, match: ["/platform/system"] },
];

export const PLATFORM_MORE: NavItem[] = [
  { id: "features", label: "Features", href: "/platform/features", icon: SlidersHorizontal, match: ["/platform/features"] },
  { id: "courses", label: "Courses", href: "/platform/courses", icon: BookOpen, match: ["/platform/courses"] },
  { id: "b2c", label: "Independent learners", href: "/platform/b2c", icon: UserRound, match: ["/platform/b2c"] },
  { id: "access", label: "Access grants", href: "/platform/access", icon: ShieldCheck, match: ["/platform/access"] },
  { id: "resets", label: "Password resets", href: "/platform/resets", icon: KeyRound, match: ["/platform/resets"] },
];
