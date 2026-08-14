"use client";

/**
 * modules/tutor — TutorPanel (REDESIGN-P2 §1.5, W2)
 *
 * The chat surface behind the FloatingTutor:
 *   xs    full-screen dialog below the AppBar
 *   md+   docked card pinned near the FAB edge, clear of chrome
 *
 * Stays mounted while closed so the conversation survives
 * open/close cycles. State changes are announced via an aria-live
 * status line (P6 §4), and every gesture has a button equivalent.
 */

import { useEffect, useRef, useState } from "react";
import { MoveHorizontal, Send, Sparkles, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/modules/shell";
import { useTutorChat } from "./use-tutor-chat";
import { useTutorStore, type TutorState } from "./tutor-store";

const STATE_TEXT: Record<TutorState, string> = {
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Replying…",
};

const QUICK_PROMPTS = [
  "Explain today's topic simply",
  "Quiz me with 3 quick questions",
  "Plan my next 15 minutes",
];

export interface TutorPanelProps {
  open: boolean;
  onClose: () => void;
  edge: "left" | "right";
  onFlipEdge: () => void;
  /** Distance (px) from viewport bottom where the panel may rest. */
  bottomOffset: number;
  /** Current route — passed to the context API with every ask. */
  surface: string;
}

export function TutorPanel({ open, onClose, edge, onFlipEdge, bottomOffset, surface }: TutorPanelProps) {
  const bp = useBreakpoint();
  const fullScreen = bp === "xs";
  const state = useTutorStore((s) => s.state);
  const { messages, streamText, streaming, error, ask, clear } = useTutorChat(surface);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the latest message in view while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streamText, open]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc closes (both docked and full-screen).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = (text: string) => {
    if (!text.trim() || streaming) return;
    setDraft("");
    void ask(text);
  };

  return (
    <section
      role="dialog"
      aria-modal={fullScreen}
      aria-label="AI tutor chat"
      className={cn(
        "z-tutor flex-col bg-surface text-fg",
        fullScreen
          ? "fixed inset-x-0 top-14 bottom-0"
          : cn(
              "fixed max-h-[min(560px,calc(100dvh-96px))] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line shadow-elev-3",
              edge === "right" ? "right-3" : "left-3"
            ),
        open ? "flex" : "hidden"
      )}
      style={fullScreen ? undefined : { bottom: bottomOffset }}
    >
      {/* header */}
      <header className="flex items-center gap-2 border-b border-line bg-surface-raised px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">AI Tutor</p>
          <p aria-live="polite" className="truncate text-xs text-fg-muted">
            {STATE_TEXT[state]}
          </p>
        </div>
        <button
          type="button"
          onClick={onFlipEdge}
          title={edge === "right" ? "Dock panel to the left" : "Dock panel to the right"}
          aria-label={edge === "right" ? "Dock panel to the left" : "Dock panel to the right"}
          className="hidden h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg md:flex"
        >
          <MoveHorizontal className="h-4.5 w-4.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={clear}
          title="Start a new conversation"
          aria-label="Start a new conversation"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <SquarePen className="h-4.5 w-4.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tutor"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Sparkles className="h-8 w-8" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Hi, I&apos;m your study tutor.</p>
              <p className="mt-1 text-xs text-fg-muted">
                Ask anything about your course — I only read and write text.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="min-h-11 rounded-full border border-line bg-bg-subtle px-3.5 text-xs text-fg-secondary transition-colors hover:border-brand hover:text-fg"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-brand text-on-brand"
                  : "rounded-bl-md border border-line bg-surface-raised text-fg"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-surface-raised px-3 py-2 text-sm leading-relaxed text-fg">
              {streamText || <ThinkingDots />}
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger"
          >
            Couldn&apos;t reach the tutor: {error}. Please try again in a moment.
          </div>
        )}
      </div>

      {/* composer */}
      <form
        className="border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={2}
            placeholder="Ask your tutor…"
            aria-label="Message the AI tutor"
            maxLength={8000}
            className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand transition-opacity disabled:opacity-40"
          >
            <Send className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-fg-muted">
          Text only — the tutor can&apos;t open files, photos or videos.
        </p>
      </form>
    </section>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Tutor is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted motion-reduce:animate-none"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
