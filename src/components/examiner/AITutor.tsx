"use client";

/**
 * AITutor — in-app AI Tutor chatbot (streaming version).
 *
 * Streams responses from /api/ai/tutor/stream so the learner sees the
 * first token in ~500ms instead of waiting 5-15s for the full reply.
 * Falls back to the non-streaming /api/ai/tutor endpoint if the stream
 * emits a `[stream-degraded: ...]` marker.
 *
 * Backend: POST /api/ai/tutor/stream (Reads course + project + week context)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Send, Brain, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/examiner/MarkdownRenderer";
import { TypingIndicator } from "@/components/shared/typing-indicator";
import { useStreamingAI } from "@/lib/use-streaming-ai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AITutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The streaming hook — handles fetch, chunk parsing, abort, cleanup.
  const { text: streamingText, streaming, error: streamError, send: streamSend, cancel: streamCancel } = useStreamingAI({
    url: "/api/ai/tutor/stream",
    onDone: (fullText) => {
      // Stream completed — append the full assistant message to the chat.
      setMessages(prev => [...prev, { role: "assistant", content: fullText }]);
      setBusy(false);
    },
    onError: async (reason) => {
      // Stream degraded — fall back to the non-streaming endpoint.
      try {
        const fallback = await api.post<{ reply: string }>("/api/ai/tutor", {
          messages: messagesRef.current,
        }, AI_TIMEOUT_MS);
        setMessages(prev => [...prev, { role: "assistant", content: fallback.reply || "I'm having trouble right now. Please try again." }]);
      } catch {
        setError(`AI Tutor is unavailable (${reason}). Please try again.`);
      }
      setBusy(false);
    },
  });

  // Keep a ref of messages so the onError callback can read the latest
  // value without re-subscribing the hook on every render.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll to bottom on new messages or streaming text updates.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, busy]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setBusy(true);
    setError("");

    // Hit the streaming endpoint. The hook handles the response.
    await streamSend({ messages: newMessages });
  }, [input, busy, messages, streamSend]);

  const clearChat = () => {
    setMessages([]);
    setError("");
    streamCancel();
  };

  // Esc cancels an in-flight stream.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && streaming) {
        e.preventDefault();
        streamCancel();
        setBusy(false);
        // Keep whatever partial text we got as the assistant message.
        if (streamingText.trim()) {
          setMessages(prev => [...prev, { role: "assistant", content: streamingText + " [stopped]" }]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming, streamingText, streamCancel]);

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <Card className="border-primary/30 bg-card flex flex-col h-full min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg text-foreground">AI Tutor</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Your personal tutor — teaches today&apos;s topic, connects it to your project.
              </CardDescription>
            </div>
            {messages.length > 0 && (
              <Button onClick={clearChat} variant="outline" size="sm" className="border-border text-xs">
                Clear chat
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Chat messages — fills available height, scrolls to bottom */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 rounded-lg border border-border bg-card/50 p-3"
          >
            {messages.length === 0 && !streaming && (
              <div className="text-center py-8 px-4">
                <Brain className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Ask me anything about your current topic, your project, or where you are in the course.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Explain today's topic with an example",
                    "How does this connect to my project?",
                    "What should I focus on this week?",
                    "Am I on track with the course?",
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs rounded-full border border-border bg-background px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/50">
                      <Bot className="h-3 w-3 text-primary opacity-70" />
                      <span className="text-[9px] font-semibold opacity-70">AI Tutor</span>
                    </div>
                  )}
                  {m.role === "assistant"
                    ? <MarkdownRenderer content={m.content} />
                    : m.content
                  }
                </div>
              </div>
            ))}

            {/* Streaming response — shows the partial text as it arrives.
                Shows the TypingIndicator (3 bouncing dots) until the first
                token lands, then shows the streaming text inline. */}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/50">
                    <Bot className="h-3 w-3 text-primary opacity-70" />
                    <span className="text-[9px] font-semibold opacity-70">AI Tutor</span>
                    <span className="ml-auto"><TypingIndicator /></span>
                  </div>
                  {streamingText
                    ? <MarkdownRenderer content={streamingText} />
                    : <span className="text-xs text-muted-foreground">Thinking…</span>
                  }
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
              {error}
            </div>
          )}

          {streamError && (
            <div className="text-xs text-growth-amber dark:text-growth-amber bg-growth-amber-soft rounded-md p-2">
              Connection slowed — retrying…
            </div>
          )}

          {/* Input area */}
          <div className="space-y-2 flex-shrink-0 pt-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="w-full min-h-[60px] max-h-[120px] rounded-lg bg-background border border-border p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ask your AI Tutor anything… (Enter to send, Shift+Enter for new line, Esc to stop)"
              disabled={busy}
              autoFocus
            />
            <div className="flex justify-end">
              {streaming ? (
                <Button onClick={streamCancel} variant="outline" className="border-border">
                  <Square className="h-4 w-4 mr-1.5" /> Stop
                </Button>
              ) : (
                <Button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/70 text-center">
            The AI Tutor uses your course outline, your project, and your current week&apos;s topic to give personalized guidance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
