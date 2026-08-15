"use client";

/**
 * modules/learn/lib/tutor-bus.ts — the tutor event bus (W16)
 *
 * The visual AI avatar (sprite rig, stage, dock) was removed — the
 * tutor is now voice + chat only. This keeps the same event-bus API
 * the classroom, panels and VoiceBar rely on:
 *   - caption / tts events (VoiceBar barge-in, captions)
 *   - play(gesture) — retained as a harmless no-op emit so every
 *     existing caller keeps compiling and behavior stays identical
 *   - say(text) — TTS via Web Speech API (opt-in, male voice)
 */

type Handler = (p?: unknown) => void;
const handlers: Record<string, Set<Handler>> = {};

export const tutor = {
  on(ev: string, fn: Handler) {
    (handlers[ev] ??= new Set()).add(fn);
    return () => {
      handlers[ev]?.delete(fn);
    };
  },
  emit(ev: string, p?: unknown) {
    handlers[ev]?.forEach((fn) => fn(p));
  },
  play(_gesture: string) {
    // No avatar rig anymore — gestures are a no-op kept for API compat.
  },
  caption(text: string) {
    this.emit("caption", text);
  },
  say(text: string, voice = true) {
    this.caption(text);
    this.emit("tts", "start");
    if (voice && typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => this.emit("tts", "end");
      u.onerror = () => this.emit("tts", "end");
      speechSynthesis.speak(u);
    } else {
      setTimeout(() => this.emit("tts", "end"), Math.min(9000, text.length * 55));
    }
  },
};
