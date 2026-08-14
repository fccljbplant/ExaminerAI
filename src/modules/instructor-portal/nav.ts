/**
 * modules/instructor-portal/nav.ts — portal navigation constants
 *
 * Plain TS (NO "use client") so both the client shell and server
 * pages can import the same arrays — crossing a client boundary from
 * a page would serialize the exports as a module proxy.
 */

import {
  BarChart3,
  ClipboardCheck,
  Home,
  LayoutTemplate,
  MoreHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Bottom tabs: Home / Courses / Students / Grading / More (5 slots). */
export const INSTRUCTOR_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/instructor", icon: Home },
  { id: "courses", label: "Courses", href: "/instructor/courses", icon: LayoutTemplate },
  { id: "students", label: "Students", href: "/instructor/students", icon: Users },
  { id: "grading", label: "Grading", href: "/instructor/review", icon: ClipboardCheck },
  { id: "more", label: "More", href: "/instructor/more", icon: MoreHorizontal },
];

/** Secondary destinations surfaced in the More hub (P3 §2). */
export const INSTRUCTOR_MORE: NavItem[] = [
  { id: "analytics", label: "Analytics", href: "/instructor/analytics", icon: BarChart3 },
  { id: "earnings", label: "Earnings", href: "/instructor/earnings", icon: Wallet },
];
