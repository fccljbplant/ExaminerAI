// src/modules/learn/lib/voice-input.ts — Web Speech API voice input (client-only).
/**
 * Voice input for the classroom: wraps `SpeechRecognition` (with the
 * webkit prefix) behind a small, testable API. No server round-trip —
 * recognition happens on-device, so there is no new backend dependency.
 *
 * Unsupported browsers (Firefox, older Safari) get
 * `isVoiceInputAvailable() === false` and the UI falls back to text.
 *
 * This file is CLIENT-ONLY — it touches `window`.
 */

// ── Ambient types ──────────────────────────────────────────────────
// SpeechRecognition is not in the TS DOM lib, so we declare the minimal
// surface we use. Kept local so consumers never see these internals.

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultItem {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True if the browser supports on-device speech recognition. */
export function isVoiceInputAvailable(): boolean {
  return getCtor() !== null;
}

// ── Session API ────────────────────────────────────────────────────

export interface VoiceInputHandlers {
  /** Live partial transcript while the user is speaking. */
  onInterim?: (text: string) => void;
  /** Complete utterance after recognition ends (pause or manual stop). */
  onFinal?: (text: string) => void;
  /** Fired the moment speech is detected — use for barge-in (stop TTS). */
  onSpeechStart?: () => void;
  /** Recognition session ended (any reason). */
  onEnd?: () => void;
  /** Human-readable error message (permission denied, no speech, …). */
  onError?: (message: string) => void;
}

export interface VoiceInputSession {
  start(): void;
  stop(): void;
  dispose(): void;
  isListening(): boolean;
}

/** Map SpeechRecognition error codes to human-readable messages. */
function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied. Allow mic access in your browser settings to ask by voice.";
    case "no-speech":
      return "I didn't catch that — try speaking again.";
    case "audio-capture":
      return "No microphone found. Plug in a mic or use text instead.";
    case "network":
      return "Voice recognition needs a network connection right now.";
    case "aborted":
      return ""; // user-initiated — not an error worth surfacing
    default:
      return "Voice input hit a snag. You can keep typing instead.";
  }
}

/**
 * Create a voice input session, or null when unsupported.
 * Accumulates final transcript segments and emits them together on end,
 * so callers receive one clean utterance per push-to-talk cycle.
 */
export function createVoiceInput(handlers: VoiceInputHandlers): VoiceInputSession | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  let recognition: SpeechRecognitionInstance | null = null;
  let listening = false;
  let finalTranscript = "";

  function build(): SpeechRecognitionInstance {
    const rec = new Ctor!();
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      listening = true;
      finalTranscript = "";
    };
    rec.onspeechstart = () => {
      handlers.onSpeechStart?.();
    };
    rec.onresult = (ev: SpeechRecognitionResultEvent) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) finalTranscript += (finalTranscript ? " " : "") + alt.transcript.trim();
        else interim += alt.transcript;
      }
      if (interim) handlers.onInterim?.(interim);
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const message = describeError(ev.error);
      if (message) handlers.onError?.(message);
    };
    rec.onend = () => {
      listening = false;
      if (finalTranscript) handlers.onFinal?.(finalTranscript);
      finalTranscript = "";
      handlers.onEnd?.();
    };
    return rec;
  }

  return {
    start() {
      if (listening) return;
      try {
        recognition = build();
        recognition.start();
      } catch {
        // start() throws if called while a session is still closing — safe to ignore
      }
    },
    stop() {
      if (!listening || !recognition) return;
      try {
        recognition.stop(); // lets onend fire with the accumulated transcript
      } catch {
        // best-effort
      }
    },
    dispose() {
      if (!recognition) return;
      try {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.abort();
      } catch {
        // best-effort
      }
      recognition = null;
      listening = false;
    },
    isListening() {
      return listening;
    },
  };
}
