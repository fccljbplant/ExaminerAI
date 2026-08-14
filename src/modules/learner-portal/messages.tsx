"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

/**
 * modules/learner-portal — Messages (W11 audit: V1 Messages restored)
 *
 * Learner↔instructor inbox on the v2 stack, over the surviving
 * RBAC-guarded /api/messages endpoints. Composer targets the assigned
 * instructor (GET /api/messages/instructor).
 */

interface Msg {
  id: string;
  subject: string | null;
  body: string;
  sentAt: string;
  isRead: boolean;
  reply: string | null;
  from: { name: string; email: string };
  to: { name: string; email: string };
}

interface InstructorInfo {
  instructor: { id: string; name: string; email: string } | null;
}

export function LearnerMessages() {
  const [box, setBox] = useState<"all" | "received" | "sent">("all");
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [instructor, setInstructor] = useState<InstructorInfo["instructor"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async (b: "all" | "received" | "sent") => {
    setError(null);
    try {
      const [m, t] = await Promise.all([
        fetch(`/api/messages?box=${b}&pageSize=50`).then((r) => r.json()),
        fetch("/api/messages/instructor").then((r) => (r.ok ? r.json() : null)),
      ]);
      setMessages((m as { messages: Msg[] }).messages ?? []);
      setInstructor((t as InstructorInfo | null)?.instructor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
  }, []);

  useEffect(() => {
    void load(box);
  }, [box, load]);

  async function send() {
    if (!body.trim() || !instructor) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: instructor.id, subject: "Question from student", body: body.trim() }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Send failed");
      setBody("");
      toast.success("Message sent to your instructor");
      void load(box);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Delete failed");
      }
      toast.success("Message deleted");
      void load(box);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Messages</h1>

      {/* composer */}
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <label htmlFor="msg-body" className="text-xs font-medium text-fg-muted">
          {instructor
            ? `Ask ${instructor.name} — they'll see it on their dashboard.`
            : "No instructor assigned yet — messages need a course instructor."}
        </label>
        <div className="flex gap-2">
          <textarea
            id="msg-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Type your question…"
            disabled={!instructor}
            className="min-h-20 flex-1 resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !body.trim() || !instructor}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Send
          </button>
        </div>
      </div>

      {/* box filter */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {(["all", "received", "sent"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={box === b}
            onClick={() => setBox(b)}
            className={`inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
              box === b
                ? "bg-brand text-on-brand"
                : "border border-line bg-surface text-fg-secondary hover:text-fg"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          {error}
          <button type="button" onClick={() => void load(box)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      )}

      {messages === null ? (
        <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <Mail className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No {box} messages</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-fg-muted">
                  <span className="font-medium text-fg-secondary">
                    {box === "sent" ? `To ${m.to.name}` : `From ${m.from.name}`}
                  </span>{" "}
                  · {new Date(m.sentAt).toLocaleString()}
                  {box !== "sent" && !m.isRead && (
                    <span className="ml-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-on-brand">
                      new
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-fg">{m.body}</p>
                {m.reply && (
                  <p className="mt-1.5 rounded-lg bg-bg-subtle px-3 py-2 text-sm leading-relaxed text-fg">
                    <span className="text-xs font-semibold text-fg-muted">Reply: </span>
                    {m.reply}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void remove(m.id)}
                aria-label="Delete message"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
