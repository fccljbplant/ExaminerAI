"use client";

// src/components/examiner/LearnerTopNav.tsx — Star Admin-style horizontal top
// navigation for the learner role. Staff roles keep the sidebar shell in
// AppShell; learners get the horizontal bar per the design reference: brand,
// primary nav, course switcher, ⌘K search, theme picker, notifications, and
// a profile menu. All colors come from theme tokens (no hardcoded palette).

import { useState } from "react";
import {
  BookOpen, Check, ChevronDown, Eye, GraduationCap, LogOut, Menu, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UnifiedThemeToggle } from "@/modules/theme";
import { NotificationBell } from "@/components/examiner/NotificationBell";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";

/** Minimal nav item shape — structurally compatible with AppShell's NavItem. */
export interface TopNavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

type SwitchableRole = "learner" | "instructor" | "org_admin" | "platform_admin";

/** Optional "view as role" switcher shown to admin-equivalent users (demo). */
export interface ViewAsRole {
  current: string;
  onSwitch: (role: SwitchableRole) => void;
}

interface LearnerTopNavProps {
  userName: string;
  userEmail: string;
  navItems: TopNavItem[];
  currentKey?: string;
  /** Navigate to a nav item (re-clicking the active item triggers a refresh). */
  onNavigate: (key: string) => void;
  unreadCount?: number;
  /** Course enrollments — the switcher renders when there is more than one. */
  courses?: EnrollmentResponse["enrollments"];
  activeCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
  onLogout: () => void;
  viewAsRole?: ViewAsRole;
}

const ROLE_OPTIONS: Array<{ role: SwitchableRole; label: string }> = [
  { role: "learner", label: "Learner" },
  { role: "instructor", label: "Instructor" },
  { role: "org_admin", label: "Org Admin" },
  { role: "platform_admin", label: "Platform Admin" },
];

/** Opens the global ⌘K palette (it listens for Ctrl/Cmd+K on window). */
function openCommandPalette(): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true })
  );
}

/** Unread count pill — shared by the desktop bar and the mobile drawer. */
function UnreadPill({ count }: { count: number }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function LearnerTopNav({
  userName,
  userEmail,
  navItems,
  currentKey,
  onNavigate,
  unreadCount = 0,
  courses,
  activeCourseId,
  onSelectCourse,
  onLogout,
  viewAsRole,
}: LearnerTopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCourse = courses?.find(c => c.courseId === activeCourseId);

  function handleNavigate(key: string) {
    setMobileOpen(false);
    onNavigate(key);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          <span className="hidden font-bold text-foreground sm:block">TraineesAI</span>
        </div>

        {/* Course switcher — only when the learner has multiple courses */}
        {courses && courses.length > 1 && onSelectCourse && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted lg:flex"
              aria-label="Switch course"
            >
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="max-w-40 truncate">{activeCourse?.courseName ?? "Select course"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>My courses</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {courses.map(c => (
                <DropdownMenuItem
                  key={c.courseId}
                  onSelect={() => onSelectCourse(c.courseId)}
                  className="gap-2"
                >
                  <span className="w-3 flex-shrink-0">
                    {c.courseId === activeCourseId && <Check className="h-3 w-3 text-primary" aria-hidden />}
                  </span>
                  <span className="flex-1 truncate">{c.courseName}</span>
                  <span className="badge-pill badge-pill-muted">Wk {c.currentWeek}/{c.totalWeeks}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Primary nav (desktop) */}
        <nav className="hidden h-full flex-1 items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = item.key === currentKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
                {item.key === "messages" && unreadCount > 0 && <UnreadPill count={unreadCount} />}
              </button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* ⌘K search — styled like Star Admin's top-bar search box */}
          <button
            type="button"
            onClick={openCommandPalette}
            className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>Search…</span>
            <kbd className="ml-1 rounded border border-border bg-card px-1 font-sans text-[10px]">⌘K</kbd>
          </button>

          <UnifiedThemeToggle />
          <NotificationBell />

          {/* View-as-role switcher (admin / demo only) */}
          {viewAsRole && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="View as role"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden capitalize sm:inline">{viewAsRole.current.replace("_", " ")}</span>
                <ChevronDown className="h-3 w-3" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>View as role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ROLE_OPTIONS.map(r => (
                  <DropdownMenuItem key={r.role} onSelect={() => viewAsRole.onSwitch(r.role)}>
                    <span className="w-4 flex-shrink-0">
                      {viewAsRole.current === r.role && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                    </span>
                    {r.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Profile menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              aria-label="Account menu"
            >
              {userName.charAt(0).toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{userEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-3.5 w-3.5" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="space-y-0.5 border-t border-border px-3 py-2 lg:hidden" aria-label="Mobile">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = item.key === currentKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === "messages" && unreadCount > 0 && <UnreadPill count={unreadCount} />}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
