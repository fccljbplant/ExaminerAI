/**
 * modules/learner-portal/nav.ts — portal navigation constants
 * (plain TS — safe across the RSC boundary).
 */

import { BookOpen, ClipboardCheck, Home, LineChart, MessagesSquare, User } from "lucide-react";
import type { NavItem } from "@/modules/shell";

/** Bottom tabs: Home / Learn / Practice / Exams / Progress / Profile. */
export const LEARNER_NAV: NavItem[] = [
  // Home is active ONLY on the exact dashboard route (no prefix match) —
  // nested routes highlight their own tab via match arrays.
  { id: "home", label: "Home", href: "/learner", icon: Home },
  {
    id: "learn",
    label: "Learn",
    href: "/learner/learn",
    icon: BookOpen,
    // "/learn" covers the public/fallback catalog and the classroom
    // (/learn/[courseId]) — prefix matching is segment-boundary safe
    // ("/learn" never matches "/learner/*", that's a different prefix).
    match: ["/learn", "/learner/learn", "/learner/courses", "/learner/assignments"],
  },
  {
    id: "practice",
    label: "Practice",
    href: "/learner/practice",
    icon: MessagesSquare,
    match: ["/learner/practice"],
  },
  { id: "exams", label: "Exams", href: "/learner/exams", icon: ClipboardCheck, match: ["/learner/exams"] },
  { id: "progress", label: "Progress", href: "/learner/progress", icon: LineChart, match: ["/learner/progress", "/learner/study"] },
  { id: "profile", label: "Profile", href: "/learner/profile", icon: User, match: ["/learner/profile", "/learner/help"] },
];
