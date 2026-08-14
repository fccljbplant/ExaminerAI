"use client";
// src/components/shared/command-registry.tsx
// Companion to <CommandPalette />. Lets any page or component register
// its own commands into the global ⌘K palette.
//
// Usage:
//   import { useCommandRegistry } from "@/modules/ui/command-registry";
//
//   function MyPage() {
//     useCommandRegistry([
//       { id: "msg-sarah", label: "Message Sarah", group: "Mentor", icon: MessageSquare, action: () => ... },
//     ]);
//     return <div>...</div>;
//   }
//
// Commands are scoped to the lifetime of the registering component —
// when it unmounts, its commands disappear from the palette.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface CommandEntry {
  /** Stable unique id — used for dedupe + React key. */
  id: string;
  /** What the user sees. Make it specific: "Message Sarah" not "Message". */
  label: string;
  /** Optional sub-label shown under the label. */
  hint?: string;
  /** Logical group: "Navigate" | "Actions" | "Mentor" | "Admin" | … */
  group?: string;
  /** Optional icon. */
  icon?: LucideIcon;
  /** Optional keyboard shortcut displayed as a hint chip. */
  shortcut?: string;
  /** What happens when the user picks this command. */
  action?: () => void;
}

interface CommandRegistryValue {
  commands: CommandEntry[];
  register: (commands: CommandEntry[]) => () => void;
}

const CommandRegistryContext = createContext<CommandRegistryValue | null>(null);

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<CommandEntry[]>([]);

  const register = (cmds: CommandEntry[]) => {
    setCommands((prev) => {
      const ids = new Set(cmds.map((c) => c.id));
      return [...prev.filter((c) => !ids.has(c.id)), ...cmds];
    });
    return () => {
      setCommands((prev) => prev.filter((c) => !cmds.some((cmd) => cmd.id === c.id)));
    };
  };

  return (
    <CommandRegistryContext.Provider value={{ commands, register }}>
      {children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry(): CommandRegistryValue {
  const ctx = useContext(CommandRegistryContext);
  if (!ctx) {
    // Provider not mounted — return a no-op so individual pages don't crash
    // in tests/storybook. The palette will still show built-in commands.
    return { commands: [], register: () => () => {} };
  }
  return ctx;
}

/** Convenience hook: register commands for the lifetime of the calling
 *  component. Cleans up on unmount. */
export function useRegisterCommands(commands: CommandEntry[]) {
  const { register } = useCommandRegistry();
  // `register` is stable (it's a useState setter wrapper); we re-run only
  // when the commands array identity changes, which is what callers expect.
  useEffect(() => register(commands), [commands]);
}
