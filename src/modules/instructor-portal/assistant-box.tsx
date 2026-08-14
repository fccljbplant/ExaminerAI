"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

/**
 * modules/instructor-portal — AIAssistantBox (W11 audit: V1 class
 * assistant restored)
 *
 * Class-level Q&A with the AI — the instructor asks about their
 * students/course and gets context-aware answers (surviving
 * /api/ai/instructor-tutor route, staff-guarded).
 */

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export function AIAssistantBox() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const text = input.trim();
    if (!text) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/instructor-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const payload = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || "AI request failed");
      setTurns([...next, { role: "assistant", content: payload.reply ?? "" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
        AI assistant
      </h2>
      <div className="rounded-xl border border-line bg-surface">
        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {turns.length === 0 && (
            <p className="text-xs text-fg-muted">
              Ask about your class — “who is struggling this week?”, “which topics need a
              re-teach?”, “draft a check-in prompt”.
            </p>
          )}
          {turns.map((t, i) => (
            <div
              key={i}
              className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                t.role === "user"
                  ? "ml-auto bg-brand-subtle text-fg"
                  : "bg-bg-subtle text-fg"
              }`}
            >
              {t.content}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-fg-muted" aria-busy="true">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Thinking…
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2 border-t border-line p-2">
          <label htmlFor="class-ai-input" className="sr-only">
            Ask the AI assistant
          </label>
          <input
            id="class-ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            placeholder="Ask about your class…"
            className="h-11 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            onClick={() => void ask()}
            disabled={busy || !input.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Ask
          </button>
        </div>
      </div>
    </section>
  );
}
