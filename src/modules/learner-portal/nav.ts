/**
 * modules/learner-portal/nav.ts — portal navigation constants
 * (plain TS — safe across the RSC boundary).
 */

import { BookOpen, ClipboardCheck, Home, LineChart, User } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Bottom tabs: Home / Learn / Exams / Progress / Profile (5 slots). */
export const LEARNER_NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/learner", icon: Home, match: "/learner" },
  { id: "learn", label: "Learn", href: "/learner/learn", icon: BookOpen },
  { id: "exams", label: "Exams", href: "/learner/exams", icon: ClipboardCheck },
  { id: "progress", label: "Progress", href: "/learner/progress", icon: LineChart },
  { id: "profile", label: "Profile", href: "/learner/profile", icon: User },
];
