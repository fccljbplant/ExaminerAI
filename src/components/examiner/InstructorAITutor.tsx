"use client";

/**
 * InstructorAITutor — AI Assistant chatbot for instructors.
 *
 * Same chat pattern as the student AI Tutor, but:
 *  - Only staff roles see it (teacher, TA, coordinator, counselor, admin).
 *  - System prompt tuned for teaching assistance: lesson prep, student case
 *    review, rubric design, parent communication, pedagogical guidance.
 *  - Behavioral signals (engagement, language, topic drift) are logged to
 *    the same ChatSession model + analysis pipeline as student sessions,
 *    so admins/principals can see teacher AI usage patterns in the admin
 *    dashboard's "Instructor Behavior" tab.
 *  - NO grading — purely assists the teacher.
 *
 * Backend: POST /api/ai/instructor-tutor
 */

import { useEffect, useRef, useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Send, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/examiner/MarkdownRenderer";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function InstructorAITutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const res = await api.post<{ reply: string }>("/api/ai/instructor-tutor", {
        messages: newMessages,
      }, AI_TIMEOUT_MS);
      // Hide technical response fields (provider, token counts, etc.) from the UI.
      setMessages(prev => [...prev, { role: "assistant", content: res.reply || "I'm having trouble responding right now. Please try again." }]);
    } catch (e) {
      // Show user-friendly error, not technical details
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("timed out") || msg.includes("timeout")) {
        setError("The AI Assistant is taking longer than expected. Please try again.");
      } else if (msg.includes("403") || msg.includes("Forbidden")) {
        setError("You don't have access to the AI Assistant. Please contact an administrator.");
      } else {
        setError("The AI Assistant is unavailable right now. Please try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <Card className="border-primary/30 bg-card flex flex-col h-full min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg text-foreground">AI Assistant</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Your instructor assistant — lesson prep, case review, rubrics, parent communications.
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
          {/* Chat messages — fills available height, scrolls to bottom on new messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 rounded-lg border border-border bg-card/50 p-3"
          >
            {messages.length === 0 && (
              <div className="text-center py-8 px-4">
                <GraduationCap className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Ask me about lesson ideas, a difficult student case, rubric design, or how to phrase a parent message.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Help me design a 30-min lesson on databases",
                    "A student hasn't submitted work in 3 days — how do I approach them?",
                    "Draft a rubric for a WordPress project",
                    "Write a parent update message about low attendance",
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
                      <span className="text-[9px] font-semibold opacity-70">AI Assistant</span>
                    </div>
                  )}
                  {m.role === "assistant"
                    ? <MarkdownRenderer content={m.content} />
                    : m.content
                  }
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2">
                  <Bot className="h-3 w-3 text-primary opacity-70" />
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">AI Assistant is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
              {error}
            </div>
          )}

          {/* Input area — stays at bottom, doesn't scroll with messages */}
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
              placeholder="Ask your AI Assistant about teaching... (Enter to send, Shift+Enter for new line)"
              disabled={busy}
              autoFocus
            />
            <div className="flex justify-end">
              <Button
                onClick={send}
                disabled={busy || !input.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/70 text-center">
            The AI Assistant logs behavioral signals (engagement, language, topic drift) to the same pipeline as student sessions — visible to admins and principals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
