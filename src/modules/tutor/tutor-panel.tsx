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

import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal, Send, Sparkles, Square, SquarePen, X } from "lucide-react";
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

/** Completed exchanges are announced politely, clipped so a long reply
 *  doesn't monopolize the screen reader. */
const LIVE_CLIP = 200;

export function clipForLive(text: string, max: number = LIVE_CLIP): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Modal focus trap for the xs full-screen dialog: keeps Tab (and
 * Shift+Tab) cycling inside the panel. Returns true when the event was
 * handled (the caller should preventDefault).
 */
function trapTab(panel: HTMLElement, shiftKey: boolean): boolean {
  const focusables = Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
  if (focusables.length === 0) return true; // nothing to cycle to — swallow Tab
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (shiftKey && document.activeElement === first) {
    last.focus();
    return true;
  }
  if (!shiftKey && document.activeElement === last) {
    first.focus();
    return true;
  }
  return false;
}

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
  const { messages, streamText, streaming, error, ask, retry, clear, cancel } = useTutorChat(surface);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Keep the latest message in view while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streamText, open]);

  // Announce completed exchanges only — the streaming bubble renders
  // outside any live region so token chunks aren't re-announced. The
  // header status line covers thinking/replying state separately.
  // Derived, not state: the live region fires when the text changes.
  const liveMsg = useMemo(() => {
    if (messages.length === 0) return "";
    const last = messages[messages.length - 1];
    return `${last.role === "user" ? "You asked" : "Tutor replied"}: ${clipForLive(last.content)}`;
  }, [messages]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc closes (both docked and full-screen). The xs full-screen dialog
  // is modal (aria-modal), so Tab is trapped inside it; on close, focus
  // goes back to what opened us (the FAB) — but only if the user hasn't
  // deliberately moved focus elsewhere.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (fullScreen && e.key === "Tab" && panelRef.current) {
        if (trapTab(panelRef.current, e.shiftKey)) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const restore = restoreFocusRef.current;
      const current = document.activeElement;
      const focusInsidePanel =
        current instanceof Node && panelRef.current?.contains(current) === true;
      if (restore && document.body.contains(restore) && (focusInsidePanel || current === document.body)) {
        restore.focus();
      }
    };
  }, [open, onClose, fullScreen]);

  const submit = (text: string) => {
    if (!text.trim() || streaming) return;
    setDraft("");
    void ask(text);
  };

  /** New conversation — confirm first when there is a chat to lose. */
  const onClear = () => {
    if (messages.length > 0 && !window.confirm("Start a new conversation? The current chat will be cleared.")) {
      return;
    }
    clear();
  };

  return (
    <section
      ref={panelRef}
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
          className="hidden h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg md:flex focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <MoveHorizontal className="h-4.5 w-4.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClear}
          title="Start a new conversation"
          aria-label="Start a new conversation"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <SquarePen className="h-4.5 w-4.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tutor"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Completed-exchange announcements (the scroller itself is NOT a
          live region — streaming chunks would be re-announced). */}
      <p aria-live="polite" className="sr-only">
        {liveMsg}
      </p>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
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
                  className="min-h-11 rounded-full border border-line bg-bg-subtle px-3.5 text-xs text-fg-secondary transition-colors hover:border-brand hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
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
            className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger"
          >
            <p className="min-w-0 flex-1">
              Couldn&apos;t reach the tutor: {error}. Your question is saved —
              retry when you&apos;re ready.
            </p>
            <button
              type="button"
              onClick={() => void retry()}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-danger/40 px-3 text-xs font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              Retry
            </button>
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
            className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            onClick={() => (streaming ? cancel() : submit(draft))}
            disabled={!streaming && !draft.trim()}
            aria-label={streaming ? "Stop generating" : "Send message"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            {streaming ? (
              <Square className="h-4 w-4" aria-hidden />
            ) : (
              <Send className="h-4.5 w-4.5" aria-hidden />
            )}
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
