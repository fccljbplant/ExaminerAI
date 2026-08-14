/**
 * modules/learner-portal/nav.ts — portal navigation constants
 * (plain TS — safe across the RSC boundary).
 */

import { BookOpen, ClipboardCheck, Home, LineChart, User } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Bottom tabs: Home / Learn / Exams / Progress / Profile (5 slots). */
export const LEARNER_NAV: NavItem[] = [
  // Home is active ONLY on the exact dashboard route (no prefix match) —
  // nested routes highlight their own tab via match arrays.
  { id: "home", label: "Home", href: "/learner", icon: Home },
  {
    id: "learn",
    label: "Learn",
    href: "/learner/learn",
    icon: BookOpen,
    match: ["/learner/learn", "/learner/courses", "/learner/assignments"],
  },
  { id: "exams", label: "Exams", href: "/learner/exams", icon: ClipboardCheck, match: ["/learner/exams"] },
  { id: "progress", label: "Progress", href: "/learner/progress", icon: LineChart, match: ["/learner/progress", "/learner/study"] },
  { id: "profile", label: "Profile", href: "/learner/profile", icon: User, match: ["/learner/profile", "/learner/help"] },
];
