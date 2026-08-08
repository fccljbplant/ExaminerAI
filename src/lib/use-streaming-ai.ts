"use client";
// src/lib/use-streaming-ai.ts
// React hook for consuming a streaming AI endpoint (e.g. /api/ai/tutor/stream).
//
// Returns the partial response as it streams in, plus a `streaming` flag
// for the typing indicator and an `error` for fallback handling.
//
// Usage:
//   const { text, streaming, error, send, cancel } = useStreamingAI({
//     url: "/api/ai/tutor/stream",
//   });
//
//   await send({ messages });
//   // text updates in real-time as chunks arrive.
//   // streaming === true while the response is in flight.
//   // error is set if the stream emits [stream-degraded: ...] or fetch fails.
//
// The hook auto-cancels the in-flight stream when the component unmounts
// or when `cancel()` is called (e.g. user pressed Esc).

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";

interface UseStreamingAIOptions {
  url: string;
  /** Called once when the stream completes with the full text. */
  onDone?: (fullText: string) => void;
  /** Called if the stream fails or emits a degraded marker. */
  onError?: (reason: string) => void;
}

interface UseStreamingAIResult {
  /** The partial text accumulated so far. Updates as chunks arrive. */
  text: string;
  /** True while the stream is in flight (for typing indicator). */
  streaming: boolean;
  /** Set if the stream fails. Caller should fall back to non-streaming. */
  error: string | null;
  /** Send a request body to the streaming endpoint. */
  send: (body: unknown) => Promise<void>;
  /** Cancel any in-flight stream. */
  cancel: () => void;
}

const DEGRADED_PREFIX = "[stream-degraded:";

export function useStreamingAI({
  url,
  onDone,
  onError,
}: UseStreamingAIOptions): UseStreamingAIResult {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (body: unknown) => {
      // Cancel any in-flight stream first.
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setText("");
      setError(null);
      setStreaming(true);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        if (!res.body) throw new Error("no response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Detect the degraded marker — the server emits it when the
          // provider fails mid-stream.
          if (accumulated.includes(DEGRADED_PREFIX)) {
            const startIdx = accumulated.indexOf(DEGRADED_PREFIX) + DEGRADED_PREFIX.length;
            const endIdx = accumulated.indexOf("]", startIdx);
            const reason = endIdx > startIdx
              ? accumulated.slice(startIdx, endIdx)
              : accumulated.slice(startIdx);
            setError(reason || "stream-degraded");
            onError?.(reason);
            // Clear the marker text from the visible output.
            setText("");
            break;
          }

          // Live-update the visible text. We sanitize on each chunk to
          // strip any disallowed tokens early (the sanitizer is cheap).
          setText(sanitizeExaminerText(accumulated) || accumulated);
        }

        // Stream complete — final sanitize + notify.
        const final = sanitizeExaminerText(accumulated) || accumulated;
        setText(final);
        onDone?.(final);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const reason = err instanceof Error ? err.message : "stream-failed";
        setError(reason);
        onError?.(reason);
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [url, onDone, onError],
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  }, []);

  // Cancel on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { text, streaming, error, send, cancel };
}
