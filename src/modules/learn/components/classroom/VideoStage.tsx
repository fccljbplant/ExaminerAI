"use client";

// src/modules/learn/components/classroom/VideoStage.tsx — Video lesson stage.
// Embeds the topic's curated YouTube video. When it ends, the parent shell
// is notified so the avatar can recap and move on to the slides.

import { useEffect, useRef, useState } from "react";
import { MonitorPlay, SkipForward } from "lucide-react";
import { logger } from "@/lib/logger";
import { ErrorState } from "@/components/ui/states";
import { createPlayer, type YTPlayerInstance } from "@/modules/learn/lib/youtube-player";
import type { LessonVideo } from "@/modules/learn/lib/lesson-media";

interface VideoStageProps {
  video: LessonVideo;
  /** Video finished (or was watched through) — avatar recap follows. */
  onEnded: () => void;
  /** Learner skips the video and goes straight to the slides. */
  onSkipToSlides: () => void;
}

export function VideoStage({ video, onEnded, onSkipToSlides }: VideoStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Bumped on retry so the mount effect re-runs after a failure.
  const [retryNonce, setRetryNonce] = useState(0);

  // Keep the latest callbacks without re-creating the player.
  const endedRef = useRef(onEnded);
  useEffect(() => {
    endedRef.current = onEnded;
  });

  useEffect(() => {
    let cancelled = false;
    const el = mountRef.current;
    if (!el) return;

    createPlayer(el, video.videoId, {
      onEnded: () => endedRef.current(),
      onPlaying: () => setReady(true),
    })
      .then((player) => {
        if (cancelled) {
          player.destroy();
          return;
        }
        playerRef.current = player;
        // onPlaying may never fire if the learner doesn't press play —
        // reveal the frame once the player exists regardless.
        setReady(true);
      })
      .catch((err) => {
        logger.warn("VideoStage player failed", { err });
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [video.videoId, retryNonce]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Section label — matches the slide stage's banner rhythm */}
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <MonitorPlay className="h-3.5 w-3.5 text-primary" aria-hidden />
        Watch first · video lesson
      </div>

      {failed ? (
        <ErrorState
          message="Couldn't load the video player. Check your connection and retry."
          onRetry={() => { setFailed(false); setReady(false); setRetryNonce(n => n + 1); }}
        />
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
          {!ready && (
            <div className="absolute inset-0 animate-pulse bg-muted" aria-label="Loading video player" />
          )}
          {/* The IFrame API replaces this div with the player iframe */}
          <div ref={mountRef} className="absolute inset-0 h-full w-full" />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium" title={video.title}>
          {video.title}
        </p>
        <button
          type="button"
          onClick={onSkipToSlides}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
          Skip to slides
        </button>
      </div>
    </div>
  );
}
