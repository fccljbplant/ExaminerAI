"use client";
// src/components/shared/typing-indicator.tsx
// The "three bouncing dots" typing indicator shown while the AI is
// streaming a response. Used in the AI Tutor chat, the test chatbot,
// and the mentor triage inbox.
//
// Modern SaaS baseline — every chat app does this. The dots are
// subtle (muted-foreground, small) so they don't compete with the
// streamed text once it starts arriving.

import { cn } from "@/lib/utils";

export function TypingIndicator({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="status"
      aria-label="AI is typing"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
    </div>
  );
}

/** A larger variant for full-width loading states. */
export function TypingIndicatorBlock({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
      <TypingIndicator />
      <span>{label}…</span>
    </div>
  );
}
