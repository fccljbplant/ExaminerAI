"use client";

// src/modules/learn/components/classroom/TutorChat.tsx — the tutor chat
// rail: always-visible rail beside the stage on md+, full-screen overlay
// sheet opened by the chat FAB on xs. One place for transcript, text
// input, voice input and the voice toggle (classroom audit A5: this was
// inlined in the 1446-line shell).

import { useEffect, useRef } from "react";
import { Send, Sparkles, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceBar } from "./VoiceBar";

export interface ChatMessage {
  id: string;
  role: "tutor" | "student";
  content: string;
  citation?: string | null;
}

interface TutorChatProps {
  courseName: string;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onAsk: (question: string) => void;
  loading: boolean;
  ttsOn: boolean;
  onToggleTTS: () => void;
  /** xs overlay state — the FAB opens it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusMode: boolean;
}

export function TutorChat({
  courseName,
  messages,
  input,
  onInputChange,
  onAsk,
  loading,
  ttsOn,
  onToggleTTS,
  open,
  onOpenChange,
  focusMode,
}: TutorChatProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript as messages arrive.
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Chat FAB — xs only; opens the chat sheet above the bottom nav */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Open tutor chat"
        className="fixed bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] right-4 z-[var(--p-z-raised)] flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:hidden"
      >
        <Send className="h-5 w-5" aria-hidden />
      </button>

      <aside
        className={cn(
          "bg-surface",
          open &&
            "fixed inset-x-0 top-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-drawer)] flex w-full flex-col md:static md:bottom-auto md:top-auto md:z-auto md:w-80 md:flex-shrink-0 md:border-l",
          !open && "hidden md:flex md:w-80 md:flex-shrink-0 md:flex-col md:border-l",
          focusMode && "md:hidden md:opacity-40 md:hover:opacity-100 lg:md:flex",
        )}
        aria-label="AI tutor chat"
      >
        {/* Chat header */}
        <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b px-3">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden />
          <span className="text-sm font-semibold text-fg">AI Tutor</span>
          <span className="hidden min-w-0 truncate text-[10px] text-fg-muted sm:inline">· {courseName}</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:hidden"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggleTTS}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            title={ttsOn ? "Mute voice" : "Unmute voice"}
            aria-label={ttsOn ? "Mute tutor voice" : "Unmute tutor voice"}
            aria-pressed={ttsOn}
          >
            {ttsOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        {/* Transcript — every spoken narration lands here too, so the
            tutor's words are always visible even with sound off. */}
        <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.role === "student" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "student" ? "bg-brand text-on-brand" : "bg-bg-subtle text-fg",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.citation && (
                  <p className="mt-1.5 font-mono text-[10px] opacity-70">{m.citation}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start">
              <div className="rounded-lg bg-bg-subtle px-3 py-2 text-sm text-fg">
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input — text + voice */}
        <div className="flex-shrink-0 border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onAsk(input);
                }
              }}
              placeholder="Ask about today's topic…"
              rows={1}
              className="max-h-32 flex-1 resize-none rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              maxLength={2000}
            />
            {/* Voice: interim words mirror into the textarea; the final
                utterance auto-sends — asking feels like talking. */}
            <VoiceBar onInterim={onInputChange} onFinal={onAsk} disabled={loading} />
            <button
              type="button"
              onClick={() => onAsk(input)}
              disabled={!input.trim() || loading}
              aria-label="Send question"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-fg-muted">Enter to send · tap the mic to ask by voice</p>
        </div>
      </aside>
    </>
  );
}
