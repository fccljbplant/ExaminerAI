/**
 * Tests for src/modules/learn/lib/voice-input.ts — Web Speech API wrapper.
 *
 * Runs in the node test environment: we stub a minimal `window` carrying a
 * mock SpeechRecognition constructor to exercise the session lifecycle
 * (interim results, final transcript accumulation, barge-in hook, error
 * mapping) and the unsupported-browser fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isVoiceInputAvailable,
  createVoiceInput,
} from "@/modules/learn/lib/voice-input";

// ── Mock SpeechRecognition ─────────────────────────────────────────

class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;

  start(): void {
    this.started = true;
    this.onstart?.();
  }
  stop(): void {
    this.stopped = true;
    this.onend?.();
  }
  abort(): void {
    this.aborted = true;
  }
}

const instances: MockSpeechRecognition[] = [];

/** Ctor wrapper that records every instance the lib creates. */
class TrackedMock extends MockSpeechRecognition {
  constructor() {
    super();
    instances.push(this);
  }
}

function makeResultEvent(segments: Array<{ text: string; isFinal: boolean }>): any {
  const list: any = { length: segments.length };
  segments.forEach((seg, i) => {
    list[i] = {
      isFinal: seg.isFinal,
      length: 1,
      0: { transcript: seg.text, confidence: 1 },
    };
  });
  return { resultIndex: 0, results: list };
}

function stubWindow(withSpeech: boolean, webkitOnly = false): void {
  const w: any = {};
  if (withSpeech) {
    if (webkitOnly) w.webkitSpeechRecognition = TrackedMock;
    else w.SpeechRecognition = TrackedMock;
  }
  (globalThis as any).window = w;
}

beforeEach(() => {
  instances.length = 0;
});

afterEach(() => {
  delete (globalThis as any).window;
});

// ── Availability / fallback ────────────────────────────────────────

describe("unsupported browsers", () => {
  it("reports unavailable and refuses to create a session without SpeechRecognition", () => {
    stubWindow(false);
    expect(isVoiceInputAvailable()).toBe(false);
    expect(createVoiceInput({})).toBeNull();
  });
});

describe("supported browsers", () => {
  it("detects window.SpeechRecognition", () => {
    stubWindow(true);
    expect(isVoiceInputAvailable()).toBe(true);
  });

  it("detects the webkit-prefixed constructor", () => {
    stubWindow(true, true);
    expect(isVoiceInputAvailable()).toBe(true);
  });
});

// ── Session lifecycle ──────────────────────────────────────────────

describe("voice input session", () => {
  it("accumulates final segments and emits one utterance on end", () => {
    stubWindow(true);
    const finals: string[] = [];
    const interims: string[] = [];
    let ended = 0;

    const session = createVoiceInput({
      onFinal: (t) => finals.push(t),
      onInterim: (t) => interims.push(t),
      onEnd: () => { ended += 1; },
    });
    expect(session).not.toBeNull();

    session!.start();
    const rec = instances[0];
    expect(rec.started).toBe(true);
    expect(session!.isListening()).toBe(true);
    // lib configures the recognition session for interim capture
    expect(rec.interimResults).toBe(true);

    rec.onresult?.(makeResultEvent([{ text: "what is a neur", isFinal: false }]));
    rec.onresult?.(makeResultEvent([{ text: "what is a neural network", isFinal: true }]));
    rec.onresult?.(makeResultEvent([{ text: "and how does it learn", isFinal: true }]));

    expect(interims).toEqual(["what is a neur"]);

    session!.stop();
    expect(rec.stopped).toBe(true);
    expect(finals).toEqual(["what is a neural network and how does it learn"]);
    expect(ended).toBe(1);
    expect(session!.isListening()).toBe(false);
  });

  it("fires onSpeechStart for barge-in", () => {
    stubWindow(true);
    let speechStarted = 0;
    const session = createVoiceInput({ onSpeechStart: () => { speechStarted += 1; } });
    session!.start();
    instances[0].onspeechstart?.();
    expect(speechStarted).toBe(1);
  });

  it("maps not-allowed to a microphone permission message", () => {
    stubWindow(true);
    const errors: string[] = [];
    const session = createVoiceInput({ onError: (m) => errors.push(m) });
    session!.start();
    instances[0].onerror?.({ error: "not-allowed" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Microphone permission denied");
  });

  it("suppresses user-initiated abort errors", () => {
    stubWindow(true);
    const errors: string[] = [];
    const session = createVoiceInput({ onError: (m) => errors.push(m) });
    session!.start();
    instances[0].onerror?.({ error: "aborted" });
    expect(errors).toHaveLength(0);
  });

  it("does not emit a final transcript when nothing was said", () => {
    stubWindow(true);
    const finals: string[] = [];
    let ended = 0;
    const session = createVoiceInput({
      onFinal: (t) => finals.push(t),
      onEnd: () => { ended += 1; },
    });
    session!.start();
    session!.stop();
    expect(finals).toHaveLength(0);
    expect(ended).toBe(1);
  });

  it("dispose aborts the recognition and clears handlers", () => {
    stubWindow(true);
    const session = createVoiceInput({});
    session!.start();
    const rec = instances[0];
    session!.dispose();
    expect(rec.aborted).toBe(true);
    expect(rec.onresult).toBeNull();
    expect(rec.onend).toBeNull();
    expect(session!.isListening()).toBe(false);
  });
});
