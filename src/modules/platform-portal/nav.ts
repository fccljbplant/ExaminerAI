/**
 * Platform admin navigation.
 *
 * One responsive destination list powers the shell at every breakpoint:
 * desktop shows a curated set plus More, tablet scrolls the same set, and
 * mobile uses four primary destinations plus a More sheet.
 */

import {
  Activity,
  Banknote,
  BookOpen,
  Building2,
  KeyRound,
  Home,
  LifeBuoy,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import type { NavItem } from "@/modules/shell";

export const PLATFORM_NAV: NavItem[] = [
  { id: "home", label: "Overview", href: "/platform", icon: Home },
  { id: "orgs", label: "Tenants", href: "/platform/orgs", icon: Building2, match: ["/platform/orgs"] },
  { id: "revenue", label: "Revenue", href: "/platform/revenue", icon: Banknote, match: ["/platform/revenue"] },
  { id: "users", label: "Users", href: "/platform/users", icon: Users, match: ["/platform/users"] },
  { id: "support", label: "Support", href: "/platform/support", icon: LifeBuoy, match: ["/platform/support"] },
  { id: "courses", label: "Courses", href: "/platform/courses", icon: BookOpen, match: ["/platform/courses"] },
  { id: "planner", label: "Planner", href: "/platform/courses/planner", icon: Wand2, match: ["/platform/courses/planner"] },
  { id: "features", label: "Features", href: "/platform/features", icon: SlidersHorizontal, match: ["/platform/features"] },
  { id: "resets", label: "Resets", href: "/platform/resets", icon: KeyRound, match: ["/platform/resets"] },
  { id: "ai", label: "AI", href: "/platform/ai", icon: Zap, match: ["/platform/ai"] },
  { id: "system", label: "System", href: "/platform/system", icon: Server, match: ["/platform/system"] },
  { id: "audit", label: "Audit", href: "/platform/audit", icon: ScrollText, match: ["/platform/audit"] },
  { id: "access", label: "Access", href: "/platform/access", icon: ShieldCheck, match: ["/platform/access"] },
  { id: "b2c", label: "Independent learners", href: "/platform/b2c", icon: UserRound, match: ["/platform/b2c"] },
  { id: "nav-config", label: "Nav config", href: "/platform/nav-config", icon: Activity, match: ["/platform/nav-config"] },
];
