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
} from "@/components/ui/command";
import {
  useCommandRegistry,
  type CommandEntry,
} from "@/components/shared/command-registry";
import {
  Home, Users, BookOpen, ClipboardList, BarChart3,
  MessageSquare, Settings, Award, Calendar, FolderGit2,
  Sparkles, ArrowRight, GraduationCap,
} from "lucide-react";

// Built-in navigation commands — always available.
const NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-home", label: "Today", hint: "Your daily routine", group: "Navigate", icon: Home, action: () => window.location.assign("/app") },
  { id: "nav-courses", label: "My Courses", hint: "Browse and switch courses", group: "Navigate", icon: BookOpen, action: () => window.location.assign("/app?view=my-courses") },
  { id: "nav-study", label: "Study", hint: "Practice, daily test, weekly test", group: "Navigate", icon: ClipboardList, action: () => window.location.assign("/app?view=study") },
  { id: "nav-project", label: "Project", hint: "Your capstone project tasks", group: "Navigate", icon: FolderGit2, action: () => window.location.assign("/app?view=project") },
  { id: "nav-progress", label: "Progress", hint: "Report cards, growth, scores", group: "Navigate", icon: BarChart3, action: () => window.location.assign("/app?view=progress") },
  { id: "nav-credentials", label: "Credentials", hint: "Certificates and badges", group: "Navigate", icon: Award, action: () => window.location.assign("/app?view=credentials") },
  { id: "nav-messages", label: "Messages", hint: "Chat with your mentor", group: "Navigate", icon: MessageSquare, action: () => window.location.assign("/app?view=messages") },
  { id: "nav-calendar", label: "Calendar", hint: "Deadlines and weekly tests", group: "Navigate", icon: Calendar, action: () => window.location.assign("/app?view=calendar") },
  { id: "nav-settings", label: "Settings", hint: "Account, theme, security", group: "Navigate", icon: Settings, action: () => window.location.assign("/app?view=settings") },
];

// Quick actions — the "do something" commands.
const ACTION_COMMANDS: CommandEntry[] = [
  { id: "act-daily-test", label: "Start today's daily test", hint: "3 Socratic questions · ~5 min", group: "Actions", icon: GraduationCap, action: () => window.location.assign("/app?view=study&mode=daily-test") },
  { id: "act-weekly-test", label: "Take weekly test", hint: "10 questions · full Socratic exam", group: "Actions", icon: ClipboardList, action: () => window.location.assign("/app?view=study&mode=weekly-test") },
  { id: "act-practice", label: "Practice drills", hint: "Wrong answers come back", group: "Actions", icon: Sparkles, action: () => window.location.assign("/app?view=study&mode=practice") },
  { id: "act-ask-mentor", label: "Ask your mentor", hint: "Send a question to your mentor", group: "Actions", icon: MessageSquare, action: () => window.location.assign("/app?view=study&mode=ask") },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { commands: registered } = useCommandRegistry();

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

  // Merge built-in + registered commands, dedupe by id.
  const allCommands = useMemo(() => {
    const merged = [...NAV_COMMANDS, ...ACTION_COMMANDS, ...registered];
    const seen = new Set<string>();
    return merged.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [registered]);

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
