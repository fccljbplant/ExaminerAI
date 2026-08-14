"use client";

import { useState } from "react";
import { MessageCircle, Mic, PencilLine, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * modules/ui — FeedbackThread (REDESIGN-P2 §1.4)
 *
 * Mentor/learner thread over a submission. Renders text, audio, and
 * annotation message kinds; the composer posts text (audio/annotation
 * composition is the W6 review-side concern). Read-only on the learner's
 * submitted view, writable in the project workspace (L7 ping-to-mentor).
 */

export interface FeedbackMsgView {
  id: string;
  kind: "text" | "audio" | "annotation";
  body: string;
  audioUrl?: string | null;
  partId?: string | null;
  authorName: string;
  authorRole: string;
  createdAt?: string;
}

export interface FeedbackThreadProps {
  messages: FeedbackMsgView[];
  readOnly?: boolean;
  /** Empty-state line when the thread has no messages. */
  emptyLabel?: string;
  onPost?: (body: string) => void;
  posting?: boolean;
  className?: string;
}

const KIND_META: Record<FeedbackMsgView["kind"], { label: string; icon: typeof MessageCircle }> = {
  text: { label: "Message", icon: MessageCircle },
  audio: { label: "Voice note", icon: Mic },
  annotation: { label: "Annotation", icon: PencilLine },
};

export function FeedbackThread({
  messages,
  readOnly,
  emptyLabel = "No messages yet.",
  onPost,
  posting,
  className,
}: FeedbackThreadProps) {
  const [body, setBody] = useState("");
  const canPost = Boolean(onPost) && !readOnly && body.trim().length > 0 && !posting;

  function submit() {
    if (!canPost) return;
    onPost?.(body.trim());
    setBody("");
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {messages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-6 text-center text-sm text-fg-muted">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {messages.map((m) => {
            const meta = KIND_META[m.kind] ?? KIND_META.text;
            const Icon = meta.icon;
            const mine = m.authorRole === "learner";
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl border px-3 py-2",
                    mine ? "border-brand-subtle bg-brand-subtle" : "border-line bg-surface"
                  )}
                >
                  <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
                    <Icon className="h-3 w-3" aria-hidden />
                    <span className="font-medium">{meta.label}</span>
                    <span>·</span>
                    <span>{m.authorName || (mine ? "You" : "Mentor")}</span>
                  </div>
                  {m.kind === "audio" && m.audioUrl ? (
                    <audio controls src={m.audioUrl} className="h-9 max-w-full" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                      {m.body || "(empty)"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onPost && !readOnly && (
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Send an update to your mentor…"
            aria-label="Message your mentor"
            className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canPost}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
