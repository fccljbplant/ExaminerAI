"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  BookOpen,
  Wand2,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  RefreshCw,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/platform-portal — PlatformTabs (W16: V1 AdminDashboard tab
 * bar restored)
 *
 * The old admin dashboard had every section as a top-level tab. This
 * reproduces that as a horizontal, scrollable tab strip shown on every
 * platform page — so Overview / Users / Courses / Features / Resets /
 * AI / System / Audit / Access / B2C / Nav Config / Maintenance are all
 * one tap away, exactly like V1.
 */

interface TabDef {
  href: string;
  label: string;
  icon: typeof Users;
}

const TABS: TabDef[] = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard },
  { href: "/platform/orgs", label: "Tenants", icon: Activity },
  { href: "/platform/revenue", label: "Revenue", icon: Banknote },
  { href: "/platform/users", label: "Users", icon: Users },
  { href: "/platform/support", label: "Support", icon: LifeBuoy },
  { href: "/platform/courses", label: "Courses", icon: BookOpen },
  { href: "/platform/courses/planner", label: "Planner", icon: Wand2 },
  { href: "/platform/features", label: "Features", icon: SlidersHorizontal },
  { href: "/platform/resets", label: "Resets", icon: KeyRound },
  { href: "/platform/ai", label: "AI", icon: Zap },
  { href: "/platform/system", label: "System", icon: Server },
  { href: "/platform/audit", label: "Audit", icon: ScrollText },
  { href: "/platform/access", label: "Access", icon: ShieldCheck },
  { href: "/platform/b2c", label: "B2C", icon: UserRound },
  { href: "/platform/nav-config", label: "Nav Config", icon: Activity },
  { href: "/platform/system", label: "Maintenance", icon: RefreshCw },
];

export function PlatformTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/platform") return pathname === "/platform";
    if (href === "/platform/system") {
      return pathname === "/platform/system";
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Platform sections"
      className={cn(
        "flex items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = isActive(t.href);
        return (
          <Link
            key={t.href + t.label}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              "[-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              active
                ? "bg-brand text-on-brand"
                : "border border-line bg-surface text-fg-secondary hover:border-line-strong hover:text-fg"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
