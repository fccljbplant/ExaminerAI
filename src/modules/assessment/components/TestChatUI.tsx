"use client";

/**
 * TestChatUI — shared chat interface for all test types (practice, daily, weekly).
 *
 * One consistent, professional chat UI. Minimal clutter:
 *   - The progress label shows ONLY the current question number ("Q3") —
 *     not "Q3 of 10" and not "Reply 2 of 5". Students are intelligent enough
 *     to know how many are left once they've been told up front.
 *   - A small line above the chat box tells them how many questions the test
 *     will ask ("This test asks 3 questions" / "15 questions"). This is set
 *     ONCE at test start, not on every reply.
 *   - No progress bar — it added visual noise without adding information.
 *
 * Props:
 * - conversation: array of { role, content, timestamp, questionIndex?, questionExplanation? }
 * - input: current input text
 * - onInputChange: (value: string) => void
 * - onSend: () => void
 * - onEndEarly?: () => void (optional — weekly/daily have it, practice has it)
 * - busy: boolean (AI is thinking)
 * - currentQuestion: number (0-based — used to show "Q{currentQuestion+1}" badge)
 * - questionCountLabel?: string (e.g. "This test asks 3 questions" — shown above chat)
 * - topicBadge?: string (optional topic badge)
 * - maxHeight?: string (default "40vh")
 * - placeholder?: string (default "Type your answer...")
 * - confidenceSelector?: React.ReactNode (daily test only)
 */

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, X, Brain, Lightbulb, CheckCircle2, BookOpen } from "lucide-react";

export interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex?: number;
  /** Per-question explanation — attached to the examiner's advancing message.
   *  Renders as a teaching card right after the message bubble so the student
   *  learns from each question immediately, not at end-of-test. */
  questionExplanation?: {
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    explanation: string;
    encouragement: string;
  };
}

interface TestChatUIProps {
  conversation: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onEndEarly?: () => void;
  busy: boolean;
  /** 0-based index of the current question. Used to show "Q{N+1}" on the
   *  examiner's bubble. Pass -1 or undefined to hide. */
  currentQuestion?: number;
  /** One-line hint shown above the chat box — e.g. "This test asks 3 questions."
   *  Set once at test start; not updated per-reply. */
  questionCountLabel?: string;
  topicBadge?: string;
  maxHeight?: string;
  placeholder?: string;
  confidenceSelector?: React.ReactNode;
}

export function TestChatUI({
  conversation,
  input,
  onInputChange,
  onSend,
  onEndEarly,
  busy,
  currentQuestion,
  questionCountLabel,
  topicBadge,
  maxHeight = "40vh",
  placeholder = "Type your answer... (Enter to send, Shift+Enter for new line)",
  confidenceSelector,
}: TestChatUIProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, busy]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Single-line question count hint — shown once, not per-reply.
          No progress bar, no "Q3 of 10", no "Reply 2 of 5". Just the
          question number badge on each examiner bubble + this hint. */}
      {questionCountLabel && (
        <div className="flex items-center justify-between text-xs mb-2 flex-shrink-0">
          <span className="text-muted-foreground">{questionCountLabel}</span>
          {topicBadge && (
            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
              {topicBadge}
            </Badge>
          )}
        </div>
      )}

      {/* Chat messages — fills available height, scrolls to bottom on new messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 rounded-lg border border-border bg-card/50 p-3"
      >
        {conversation.map((m, i) => (
          <div
            key={i}
            className={cn("flex", m.role === "student" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "student"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              {m.role === "examiner" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="h-3 w-3 text-primary opacity-70" />
                  <span className="text-[9px] font-semibold opacity-70">
                    TraineesAI
                    {m.questionIndex !== undefined && m.questionIndex >= 0 && (
                      <span className="ml-1">· Q{m.questionIndex + 1}</span>
                    )}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.questionExplanation && (
                <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-primary font-semibold">
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>Question explanation</span>
                  </div>
                  <div className="space-y-1.5 text-foreground/90">
                    <div>
                      <span className="font-semibold text-foreground">Correct answer: </span>
                      <span>{m.questionExplanation.correctAnswer}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <BookOpen className="h-3 w-3 mt-0.5 text-primary/70 flex-shrink-0" />
                      <span>{m.questionExplanation.explanation}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{m.questionExplanation.encouragement}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2">
              <Brain className="h-3 w-3 text-primary opacity-70" />
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs text-muted-foreground">TraineesAI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Confidence selector (daily test only) */}
      {confidenceSelector && <div className="flex-shrink-0">{confidenceSelector}</div>}

      {/* Input area — stays at the bottom, doesn't scroll with messages */}
      <div className="space-y-2 flex-shrink-0 pt-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="w-full min-h-[60px] max-h-[120px] rounded-lg bg-background border border-border p-3 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder}
          disabled={busy}
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            onClick={onSend}
            disabled={busy || !input.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
          {onEndEarly && (
            <Button
              onClick={onEndEarly}
              disabled={busy}
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground"
            >
              <X className="h-3 w-3" /> End early
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
