"use client";

import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Home,
  LineChart,
  MessageSquare,
  Settings,
  User,
} from "lucide-react";
import { AppShellV2, ModeToggle, ActionBar, useBreakpoint } from "@/modules/shell";
import { Kpi, StatStrip } from "@/modules/ui/kpi";
import { ListCard, ListCardRow } from "@/modules/ui/list-card";
import { PageHeaderV2 } from "@/modules/ui/page-header-v2";
import { Button } from "@/modules/ui/button";
import type { NavItem } from "@/modules/shell";

/**
 * Dev-only dummy content exercising the adaptive shell at all four
 * breakpoints (resize the window: xs BottomNav → md TabRow → lg
 * condensed TopNav + More → xl full TopNav).
 */

const NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/preview/shell", icon: Home, match: "/preview/shell" },
  { id: "learn", label: "Learn", href: "/preview/shell/learn", icon: BookOpen },
  { id: "assignments", label: "Assignments", href: "/preview/shell/assignments", icon: ClipboardList, badge: 3 },
  { id: "progress", label: "Progress", href: "/preview/shell/progress", icon: LineChart },
  { id: "messages", label: "Messages", href: "/preview/shell/messages", icon: MessageSquare, badge: 12 },
  { id: "profile", label: "Profile", href: "/preview/shell/profile", icon: User },
  { id: "settings", label: "Settings", href: "/preview/shell/settings", icon: Settings },
];

export function ShellPreview() {
  const bp = useBreakpoint();

  return (
    <AppShellV2
      nav={NAV}
      brand={{ name: "TraineesAI", logo: <GraduationCap className="h-5 w-5" aria-hidden /> }}
      trailing={
        <>
          <ModeToggle />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg">
            NA
          </span>
        </>
      }
    >
      <PageHeaderV2
        title={`Shell preview — ${bp}`}
        subtitle="Resize across 360 / 768 / 1024 / 1280 to see the four structures."
      />

      <div className="mt-4 space-y-6">
        <StatStrip>
          <Kpi label="Active learners" value="128" delta={{ label: "+9 this week", direction: "up", sentiment: "good" }} />
          <Kpi label="Submissions in review" value="17" delta={{ label: "4 overdue", direction: "down", sentiment: "bad" }} />
          <Kpi label="Avg. rubric score" value="82%" delta={{ label: "+3 pts", direction: "up", sentiment: "good" }} />
          <Kpi label="Sign-offs issued" value="36" />
        </StatStrip>

        <ListCard
          header={
            <div className="flex items-center justify-between">
              <span>Recent submissions</span>
              <Button variant="ghost" size="sm" className="h-7 text-fg-secondary">View all</Button>
            </div>
          }
        >
          <ListCardRow title="HSE risk assessment — draft 2" meta="Amara O. · submitted 2h ago" trailing={<span className="text-xs text-warning">In review</span>} />
          <ListCardRow title="eBay listing optimisation project" meta="Jonas K. · submitted 1d ago" trailing={<span className="text-xs text-success">Approved</span>} />
          <ListCardRow title="Mobile repair — diagnostic flow" meta="Priya S. · resubmitted 3h ago" trailing={<span className="text-xs text-danger">Changes requested</span>} />
        </ListCard>

        <p className="max-w-prose text-sm text-fg-secondary">
          Body copy sits at 14px desktop / 16px mobile with tabular numerals for
          data. Surfaces use <code className="rounded bg-bg-subtle px-1">bg-surface</code>,
          hairlines use <code className="rounded bg-bg-subtle px-1">border-line</code>,
          and every color resolves through the semantic token layer — switch
          Light / Dark / Bed above to verify.
        </p>
      </div>

      <ActionBar>
        <Button variant="outline">Cancel</Button>
        <Button>Save changes</Button>
      </ActionBar>
    </AppShellV2>
  );
}
