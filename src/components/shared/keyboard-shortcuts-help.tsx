"use client";
// src/components/shared/keyboard-shortcuts-help.tsx
// Press `?` anywhere (when not typing) to see the cheat-sheet overlay.
// Modern SaaS baseline — Linear, Superhuman, GitHub, Raycast, Cursor all
// do this. Critical for power-user adoption.
//
// Mount once at the app root (see src/app/layout.tsx). The dialog reads
// the canonical shortcut list from SHARED_SHORTCUTS so the palette and
// the help dialog can never drift apart.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ShortcutDef {
  keys: string;
  description: string;
  group: string;
}

// The canonical shortcut list — single source of truth.
// Pages can register their own shortcuts via useRegisterCommands()
// (see command-registry.tsx); these are the always-on global ones.
export const SHARED_SHORTCUTS: ShortcutDef[] = [
  { keys: "⌘ K", description: "Open command palette", group: "Global" },
  { keys: "/", description: "Focus search (also opens ⌘K)", group: "Global" },
  { keys: "?", description: "Show this cheat sheet", group: "Global" },
  { keys: "Esc", description: "Close any dialog / palette / sheet", group: "Global" },
  { keys: "g h", description: "Go to Today (home)", group: "Navigate" },
  { keys: "g s", description: "Go to Study", group: "Navigate" },
  { keys: "g p", description: "Go to Project", group: "Navigate" },
  { keys: "g r", description: "Go to Progress", group: "Navigate" },
  { keys: "g m", description: "Go to Messages", group: "Navigate" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Press `?` (Shift+/) — but only when not typing in an input.
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Group shortcuts by their `group` field.
  const grouped = SHARED_SHORTCUTS.reduce((acc, s) => {
    if (!acc.has(s.group)) acc.set(s.group, []);
    acc.get(s.group)!.push(s);
    return acc;
  }, new Map<string, ShortcutDef[]>());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="kbd">?</kbd> anywhere to see this. The app is
            keyboard-first — learn these and you&apos;ll fly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {group}
              </p>
              <dl className="space-y-1.5">
                {items.map((s) => (
                  <div
                    key={s.keys + s.description}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{s.description}</dt>
                    <dd>
                      <kbd className="kbd">{s.keys}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}
