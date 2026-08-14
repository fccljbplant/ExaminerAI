"use client";

// src/modules/learn/components/avatar/AvatarStage.tsx — On-stage teacher avatar.
// Promotes the avatar from floating dock to "teacher at the board": the rig
// stands on a podium beside the lesson stage, with a caption bubble for what
// it's saying and a live status plate (Listening / Thinking / Speaking).

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { captionsEnabled, useCaptionsStore, useThemeV2 } from "@/modules/theme";
import { AvatarRig, tutor } from "@/modules/learn/components/avatar/avatar-rig";

type TeacherStatus = "ready" | "listening" | "thinking" | "speaking";

const STATUS_LABEL: Record<TeacherStatus, string> = {
  ready: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

interface AvatarStageProps {
  /** Rig size in px (square). Defaults to 176. */
  size?: number;
  /** Extra classes on the outer podium. */
  className?: string;
}

export function AvatarStage({ size = 176, className }: AvatarStageProps) {
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<TeacherStatus>("ready");

  // Caption preference + theme mode: in Bed Mode (auto) or explicit "on",
  // the caption bubble stays on screen instead of fading after 8s — the
  // P6 §3 "captions default ON in bed" guarantee.
  const captionsMode = useCaptionsStore((s) => s.captionsMode);
  const { mode } = useThemeV2();
  const keepCaptions = captionsEnabled(captionsMode, mode);
  // Ref so the caption handler never re-subscribes when the preference flips.
  const keepRef = useRef(keepCaptions);
  useEffect(() => {
    keepRef.current = keepCaptions;
  }, [keepCaptions]);

  // Caption bubble + status plate driven by the shared tutor bus.
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    let capTimer: ReturnType<typeof setTimeout>;

    unsubs.push(tutor.on("caption", (text: unknown) => {
      setCaption(text as string);
      clearTimeout(capTimer);
      // Without captions (e.g. light mode, auto) the bubble is a transient
      // speech indicator — 8s, matching the longest narration estimate.
      capTimer = setTimeout(() => {
        if (!keepRef.current) setCaption("");
      }, 8000);
    }));
    unsubs.push(tutor.on("tts", (phase: unknown) => {
      setStatus(phase === "start" ? "speaking" : "ready");
    }));
    unsubs.push(tutor.on("gesture", (g: unknown) => {
      if (g === "think") setStatus("thinking");
      else if (g === "listen") setStatus("listening");
    }));

    return () => { unsubs.forEach(u => u()); clearTimeout(capTimer); };
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* Caption bubble — what the teacher is saying right now */}
      <div
        className={cn(
          "min-h-[3.5rem] w-full max-w-[220px] rounded-xl border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground shadow-sm transition-opacity",
          caption ? "opacity-100" : "opacity-0"
        )}
        aria-live="polite"
      >
        {caption || "…"}
      </div>

      {/* Podium — token-based backdrop so presets/themes keep working */}
      <div
        className={cn(
          "relative flex items-end justify-center overflow-hidden rounded-2xl border border-border",
          "bg-[radial-gradient(circle_at_50%_0%,var(--accent)_0%,var(--muted)_55%,var(--card)_100%)]"
        )}
        style={{ width: size + 24, height: size + 24 }}
      >
        <AvatarRig size={size} />
        {/* Floor shadow */}
        <div
          className="pointer-events-none absolute bottom-1.5 left-1/2 h-2 w-3/5 -translate-x-1/2 rounded-full bg-foreground/10 blur-[2px]"
          aria-hidden
        />
      </div>

      {/* Name plate + live status */}
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
        <Sparkles className="h-3 w-3 text-primary" aria-hidden />
        <span className="text-[11px] font-semibold">AI Tutor</span>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            status === "speaking" && "bg-growth-sage animate-pulse",
            status === "listening" && "bg-destructive animate-pulse",
            status === "thinking" && "bg-growth-amber animate-pulse",
            status === "ready" && "bg-muted-foreground/40"
          )}
          aria-hidden
        />
        <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[status]}</span>
      </div>
    </div>
  );
}
