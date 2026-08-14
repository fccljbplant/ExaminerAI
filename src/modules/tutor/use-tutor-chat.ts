"use client";

/**
 * modules/tutor — useTutorChat (W2)
 *
 * Chat session hook for the floating tutor. Wraps the shared
 * useStreamingAI hook against POST /api/v2/tutor/ask (SSE) and drives
 * the rig state machine:
 *
 *   ask() → thinking → (first token) speaking → listening
 *                                   └→ error → idle
 *
 * Text-only by contract: the composer accepts plain text, and the
 * server never requests files or media (P2 §1.5, P4 §tutorContext).
 */

import { useCallback, useEffect, useState } from "react";
import { useStreamingAI } from "@/hooks/use-streaming-ai";
import { useTutorStore } from "./tutor-store";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** How many trailing messages ride along with each request. */
const CONTEXT_WINDOW = 20;

export function useTutorChat(surface: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const setState = useTutorStore((s) => s.setState);

  const { text, streaming, send, cancel } = useStreamingAI({
    url: "/api/v2/tutor/ask",
    onDone: (fullText) => {
      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      setState("listening");
    },
    onError: (reason) => {
      setError(reason);
      setState("idle");
    },
  });

  // First streamed token flips the rig from thinking → speaking.
  useEffect(() => {
    if (streaming && text.length > 0 && useTutorStore.getState().state === "thinking") {
      setState("speaking");
    }
  }, [streaming, text, setState]);

  const ask = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || streaming) return;
      setError(null);
      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setState("thinking");
      await send({ messages: next.slice(-CONTEXT_WINDOW), surface });
    },
    [messages, streaming, send, setState, surface]
  );

  const clear = useCallback(() => {
    cancel();
    setMessages([]);
    setError(null);
    setState("idle");
  }, [cancel, setState]);

  return { messages, streamText: text, streaming, error, ask, clear, cancel };
}
