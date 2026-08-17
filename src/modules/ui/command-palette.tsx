"use client";
// src/components/shared/command-palette.tsx
// Global ⌘K command palette — the modern SaaS baseline (Linear, Notion,
// Vercel, Figma, GitHub, Raycast, Superhuman all do this).
//
// Mount once at the app root (see src/app/layout.tsx). Press ⌘K (or Ctrl+K
// on Windows/Linux) anywhere to open. Type to fuzzy-search every page,
// quick action, and role-specific shortcut.
//
// Pages and components can register their own commands via the
// `useCommandRegistry()` hook — see src/components/shared/command-registry.tsx.
//
// Built-in navigation commands are ROLE-AWARE (2026-08-17): the palette
// reads /api/auth/me once and swaps the destination set per role —
// previously every role got learner-only commands that bounced them
// around the learner portal.
//
// Voice: casual-yet-professional (per docs/UI-STANDARDS.md).
// "Jump to anything. Try 'math week 3' or 'message sarah'."

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/modules/ui/command";
import {
  useCommandRegistry,
  type CommandEntry,
} from "@/modules/ui/command-registry";
import {
  Home, Users, BookOpen, ClipboardList, BarChart3,
  MessageSquare, Settings, Award, Calendar, FolderGit2,
  Sparkles, ArrowRight, GraduationCap,
} from "lucide-react";

// Built-in navigation commands — always available.
const LEARNER_NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-home", label: "Today", hint: "Your daily routine", group: "Navigate", icon: Home, action: () => window.location.assign("/learner") },
  { id: "nav-courses", label: "My Courses", hint: "Browse and switch courses", group: "Navigate", icon: BookOpen, action: () => window.location.assign("/learner/learn") },
  { id: "nav-study", label: "Study", hint: "Practice, daily test, weekly test", group: "Navigate", icon: ClipboardList, action: () => window.location.assign("/learner/exams") },
  { id: "nav-project", label: "Project", hint: "Your capstone project tasks", group: "Navigate", icon: FolderGit2, action: () => window.location.assign("/learner/progress") },
  { id: "nav-progress", label: "Progress", hint: "Report cards, growth, scores", group: "Navigate", icon: BarChart3, action: () => window.location.assign("/learner/progress") },
  { id: "nav-credentials", label: "Credentials", hint: "Certificates and badges", group: "Navigate", icon: Award, action: () => window.location.assign("/learner/progress") },
  { id: "nav-messages", label: "Messages", hint: "Chat with your mentor", group: "Navigate", icon: MessageSquare, action: () => window.location.assign("/learner/messages") },
  { id: "nav-calendar", label: "Calendar", hint: "Deadlines and weekly tests", group: "Navigate", icon: Calendar, action: () => window.location.assign("/learner/progress") },
  { id: "nav-settings", label: "Settings", hint: "Account, theme, security", group: "Navigate", icon: Settings, action: () => window.location.assign("/learner/profile") },
];

// Quick actions — the "do something" commands.
const LEARNER_ACTION_COMMANDS: CommandEntry[] = [
  { id: "act-daily-test", label: "Start today's daily test", hint: "3 Socratic questions · ~5 min", group: "Actions", icon: GraduationCap, action: () => window.location.assign("/learner/exams/daily") },
  { id: "act-weekly-test", label: "Take weekly test", hint: "10 questions · full Socratic exam", group: "Actions", icon: ClipboardList, action: () => window.location.assign("/learner/exams/weekly") },
  { id: "act-practice", label: "Practice drills", hint: "Wrong answers come back", group: "Actions", icon: Sparkles, action: () => window.location.assign("/learner/practice") },
  { id: "act-ask-mentor", label: "Ask your mentor", hint: "Send a question to your mentor", group: "Actions", icon: MessageSquare, action: () => window.location.assign("/learner/messages") },
];

// ── Role-aware built-in commands (2026-08-17) ─────────────────────────
// Each role gets navigation + quick actions that actually land somewhere
// useful for them. The learner set is the default fallback.

const INSTRUCTOR_NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-home", label: "Home", hint: "Grading queue overview", group: "Navigate", icon: Home, action: () => window.location.assign("/instructor") },
  { id: "nav-courses", label: "Courses", hint: "Assignments & events", group: "Navigate", icon: BookOpen, action: () => window.location.assign("/instructor/courses") },
  { id: "nav-students", label: "Students", hint: "Roster and at-risk", group: "Navigate", icon: Users, action: () => window.location.assign("/instructor/students") },
  { id: "nav-grading", label: "Grading", hint: "Review queue", group: "Navigate", icon: ClipboardList, action: () => window.location.assign("/instructor/review") },
  { id: "nav-studio", label: "Studio", hint: "Create a course", group: "Navigate", icon: Sparkles, action: () => window.location.assign("/instructor/studio") },
  { id: "nav-payouts", label: "Payouts", hint: "Earnings & payouts", group: "Navigate", icon: Award, action: () => window.location.assign("/instructor/payouts") },
  { id: "nav-settings", label: "Settings", hint: "Account, theme, security", group: "Navigate", icon: Settings, action: () => window.location.assign("/instructor/settings") },
];

const ORG_NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-home", label: "Home", hint: "Org command center", group: "Navigate", icon: Home, action: () => window.location.assign("/org") },
  { id: "nav-people", label: "People", hint: "Roster, departments, invites", group: "Navigate", icon: Users, action: () => window.location.assign("/org/people") },
  { id: "nav-control", label: "Control", hint: "Branding & catalog", group: "Navigate", icon: Settings, action: () => window.location.assign("/org/control") },
  { id: "nav-compliance", label: "Compliance", hint: "Training status matrix", group: "Navigate", icon: ClipboardList, action: () => window.location.assign("/org/compliance") },
  { id: "nav-billing", label: "Billing", hint: "Plans & seats", group: "Navigate", icon: Award, action: () => window.location.assign("/org/billing") },
  { id: "nav-audit", label: "Audit", hint: "Activity log", group: "Navigate", icon: BarChart3, action: () => window.location.assign("/org/audit") },
];

const PLATFORM_NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-home", label: "Overview", hint: "Platform KPIs & revenue", group: "Navigate", icon: Home, action: () => window.location.assign("/platform") },
  { id: "nav-tenants", label: "Tenants", hint: "Org lifecycle", group: "Navigate", icon: Users, action: () => window.location.assign("/platform/orgs") },
  { id: "nav-revenue", label: "Revenue", hint: "MRR & payouts", group: "Navigate", icon: BarChart3, action: () => window.location.assign("/platform/revenue") },
  { id: "nav-users", label: "Users", hint: "Manage accounts", group: "Navigate", icon: Users, action: () => window.location.assign("/platform/users") },
  { id: "nav-support", label: "Support", hint: "Lookup & login-as", group: "Navigate", icon: MessageSquare, action: () => window.location.assign("/platform/support") },
  { id: "nav-features", label: "Features", hint: "Flags & rollouts", group: "Navigate", icon: Settings, action: () => window.location.assign("/platform/features") },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const { commands: registered } = useCommandRegistry();

  // Read the user's role once so built-in commands match their portal.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { role?: string } } | null) => {
        if (!cancelled && d?.user?.role) setRole(d.user.role);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Global ⌘K / Ctrl+K listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      // Press "/" to focus search when not in an input — Raycast-style.
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Merge built-in + registered commands, dedupe by id. Built-ins are
  // chosen by role (learner default).
  const allCommands = useMemo(() => {
    const nav = role === "instructor"
      ? INSTRUCTOR_NAV_COMMANDS
      : role === "org_admin"
        ? ORG_NAV_COMMANDS
        : role === "platform_admin"
          ? PLATFORM_NAV_COMMANDS
          : LEARNER_NAV_COMMANDS;
    const actions = role === "learner" || role === null ? LEARNER_ACTION_COMMANDS : [];
    const merged = [...nav, ...actions, ...registered];
    const seen = new Set<string>();
    return merged.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [registered, role]);

  // Group commands by their `group` field.
  const grouped = useMemo(() => {
    const map = new Map<string, CommandEntry[]>();
    for (const cmd of allCommands) {
      const g = cmd.group ?? "Commands";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(cmd);
    }
    return Array.from(map.entries());
  }, [allCommands]);

  const runCommand = useCallback((cmd: CommandEntry) => {
    setOpen(false);
    // Defer so the dialog close animation doesn't fight the navigation.
    setTimeout(() => cmd.action?.(), 50);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to anything — try 'daily test' or 'messages'…" />
      <CommandList>
        <CommandEmpty>No matches. Try another search.</CommandEmpty>
        {grouped.map(([groupName, items], idx) => (
          <div key={groupName}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={groupName}>
              {items.map((cmd) => {
                const Icon = cmd.icon ?? ArrowRight;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.hint ?? ""}`}
                    onSelect={() => runCommand(cmd)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{cmd.label}</span>
                      {cmd.hint && (
                        <span className="text-[11px] text-muted-foreground">{cmd.hint}</span>
                      )}
                    </div>
                    {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}
