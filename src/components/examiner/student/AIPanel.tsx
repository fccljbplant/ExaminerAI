"use client";

/**
 * AIPanel — Phase 3 of the TraineesAI modernization.
 *
 * A persistent right-side panel (or bottom sheet on mobile) that accompanies
 * the SlideViewer. The conversation thread is owned by the PARENT (passed in
 * via `messages`), so it carries across slides without resetting when the
 * student navigates.
 *
 * Features:
 *   - "AI is reading: {current slide}" strip at the top
 *   - Conversation thread (parent-controlled, scrollable)
 *   - Proactive bubble that pops in (scale 0.7 → 1) when `bubbleContent` is set
 *   - Quick-action chips: "Explain differently", "Give an example", "I'm stuck"
 *   - Input box: "/" focuses it, Enter sends, Shift+Enter = newline
 *
 * The AI orb uses a violet → cyan gradient to distinguish AI messages from
 * user messages.
 */

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/modules/ui/card";
import { Badge } from "@/modules/ui/badge";
import { Button } from "@/modules/ui/button";
import { Textarea } from "@/modules/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Sparkles, X, Lightbulb, RotateCw, HelpCircle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  /** Which slide number this message was sent on (1-indexed). */
  slideNum?: number;
}

interface AIPanelProps {
  /** Label of the slide the student is currently on, e.g. "Code · makeCounter walkthrough" */
  currentSlideLabel: string;
  /** Conversation thread — owned by the parent so it persists across slides. */
  messages: AIMessage[];
  /** Called when the user sends a new message. */
  onSend: (text: string) => void;
  /** Called when a quick-action chip is clicked. */
  onQuickAction?: (action: string) => void;
  /** When non-null, shows a proactive bubble above the input. */
  bubbleContent?: string | null;
  /** Called when the user dismisses the proactive bubble. */
  onBubbleDismiss?: () => void;
}

// ============================================================
// Constants
// ============================================================

const QUICK_ACTIONS = [
  { id: "explain-differently", label: "Explain differently", icon: RotateCw },
  { id: "give-example",        label: "Give an example",     icon: Lightbulb },
  { id: "stuck",               label: "I'm stuck",           icon: HelpCircle },
] as const;

// ============================================================
// Sub-components
// ============================================================

/** The AI orb — a violet → cyan gradient circle with a sparkle icon. */
function AIOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full",
        "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400",
        "shadow-[0_0_12px_-2px_rgba(139,92,246,0.5)]",
        className
      )}
    >
      <Bot className="h-1/2 w-1/2 text-white" />
    </div>
  );
}

/** A single chat message — assistant on the left (with orb), user on the right. */
function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {isUser ? (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold border border-border">
          You
        </div>
      ) : (
        <AIOrb className="h-7 w-7 flex-shrink-0" />
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.slideNum != null && (
          <p className={cn(
            "mt-1 text-[9px] uppercase tracking-wider",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            on slide {message.slideNum}
          </p>
        )}
      </div>
    </div>
  );
}

/** Proactive bubble — pops in with a scale animation when content is set. */
function ProactiveBubble({
  content,
  onDismiss,
}: {
  content: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative animate-in fade-in zoom-in-50 duration-300 origin-bottom-right"
      style={{ animationName: "aiBubblePop" }}
    >
      <style>{`
        @keyframes aiBubblePop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="flex items-start gap-2 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-2.5 pr-8">
        <Sparkles className="h-3.5 w-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/90 leading-relaxed">{content}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Main AIPanel
// ============================================================

export default function AIPanel({
  currentSlideLabel,
  messages,
  onSend,
  onQuickAction,
  bubbleContent,
  onBubbleDismiss,
}: AIPanelProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Global "/" shortcut — focus the input. Skip when typing in another input.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Card className="border-border bg-card flex flex-col h-full max-h-full overflow-hidden">
      {/* Header — "AI is reading: {slide}" strip */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
        <AIOrb className="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            AI is reading
          </p>
          <p className="text-xs font-medium text-foreground truncate">
            {currentSlideLabel}
          </p>
        </div>
        <Badge variant="outline" className="text-[9px] border-violet-500/30 text-violet-500 flex-shrink-0">
          <Sparkles className="h-2.5 w-2.5" />
          Live
        </Badge>
      </div>

      {/* Conversation thread — scrollable, flex-1 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 gap-2">
            <AIOrb className="h-10 w-10" />
            <p className="text-xs text-foreground font-medium">Ask me anything about this slide</p>
            <p className="text-[11px] text-muted-foreground max-w-[220px] leading-relaxed">
              The conversation carries across slides — your context is preserved.
              Use the chips below for quick prompts, or just type.
            </p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}

        {/* Proactive bubble — sits at the bottom of the thread */}
        {bubbleContent && (
          <ProactiveBubble content={bubbleContent} onDismiss={onBubbleDismiss} />
        )}
      </div>

      {/* Quick-action chips */}
      {onQuickAction && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border bg-muted/20 overflow-x-auto">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.id}
                onClick={() => onQuickAction(qa.id)}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/30 transition-colors"
              >
                <Icon className="h-3 w-3" />
                {qa.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Input box */}
      <div className="p-3 border-t border-border bg-card">
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question… (/ to focus, Enter to send)"
            className="min-h-[60px] max-h-[140px] resize-none pr-10 text-xs"
            rows={2}
          />
          <Button
            onClick={submit}
            disabled={!input.trim()}
            size="icon"
            variant="default"
            className="absolute bottom-2 right-2 h-7 w-7"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/70">
          Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px]">/</kbd> to focus · <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px]">Enter</kbd> to send · <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px]">Shift+Enter</kbd> for newline
        </p>
      </div>
    </Card>
  );
}
