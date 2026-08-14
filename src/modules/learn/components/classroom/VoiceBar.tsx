"use client";

// src/modules/learn/components/classroom/VoiceBar.tsx — Mic control for voice Q&A.
// Click-to-toggle listening (push-to-talk proved awkward for long questions).
// Barge-in: the moment speech is detected we stop tutor TTS so the learner
// never talks over the avatar. Unsupported browsers get a disabled mic with
// an explanatory tooltip — text input keeps working.

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { stopTTS } from "@/modules/learn/lib/tts-filter";
import {
  createVoiceInput,
  isVoiceInputAvailable,
  type VoiceInputSession,
} from "@/modules/learn/lib/voice-input";
import { tutor } from "@/modules/learn/components/avatar/avatar-rig";

interface VoiceBarProps {
  /** Live partial transcript — parent mirrors it into the textarea. */
  onInterim: (text: string) => void;
  /** Complete utterance — parent auto-sends it as the question. */
  onFinal: (text: string) => void;
  /** Disable mic while the tutor is answering. */
  disabled?: boolean;
}

export function VoiceBar({ onInterim, onFinal, disabled = false }: VoiceBarProps) {
  const [supported] = useState(() => isVoiceInputAvailable());
  const [listening, setListening] = useState(false);
  const sessionRef = useRef<VoiceInputSession | null>(null);

  // Keep callbacks in refs so the recognition session never goes stale.
  const interimRef = useRef(onInterim);
  const finalRef = useRef(onFinal);
  interimRef.current = onInterim;
  finalRef.current = onFinal;

  useEffect(() => {
    if (!supported) return;
    sessionRef.current = createVoiceInput({
      onInterim: (text) => interimRef.current(text),
      onFinal: (text) => finalRef.current(text),
      // Barge-in: learner starts speaking → avatar stops talking immediately.
      onSpeechStart: () => {
        stopTTS();
        tutor.emit("tts", "end");
      },
      onEnd: () => setListening(false),
      onError: (message) => toast.error(message),
    });
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, [supported]);

  function toggle() {
    const session = sessionRef.current;
    if (!session || disabled) return;
    if (listening) {
      session.stop();
      setListening(false);
    } else {
      tutor.play("listen");
      session.start();
      setListening(true);
    }
  }

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input isn't supported in this browser — type your question instead"
        aria-label="Voice input not supported"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground opacity-40 cursor-not-allowed"
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Stop listening" : "Ask by voice"}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      aria-pressed={listening}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
        listening
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "hover:bg-muted text-muted-foreground"
      )}
    >
      {/* Listening pulse — SpeechRecognition exposes no amplitude, so a
          simple ring signals "I'm hearing you" instead of a fake meter. */}
      {listening && (
        <span className="absolute inset-0 rounded-md border border-destructive/60 animate-ping" aria-hidden />
      )}
      <Mic className="h-4 w-4" />
    </button>
  );
}
