// src/modules/learn/lib/youtube-player.ts — YouTube IFrame API wrapper (client-only).
/**
 * Thin wrapper around the YouTube IFrame Player API so VideoStage can:
 *   - embed a video without cookies (youtube-nocookie)
 *   - get an onEnded callback (triggers the avatar's recap)
 *
 * The API script is injected once, on demand. CLIENT-ONLY.
 */

// ── Minimal ambient types (the API has no bundled typings) ────────

export interface YTPlayerEvent {
  target: YTPlayerInstance;
  data: number;
}

export interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
  getPlayerState(): number;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (ev: YTPlayerEvent) => void;
    onStateChange?: (ev: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (el: string | HTMLElement, opts: YTPlayerOptions) => YTPlayerInstance;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

/** Player state constants (mirrors YT.PlayerState). */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** Load the IFrame API script exactly once. */
export function loadYouTubeAPI(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is client-only"));
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const w = window as unknown as {
      YT?: YTNamespace;
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
      else reject(new Error("YouTube API failed to initialize"));
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => reject(new Error("Couldn't load the video player"));
    document.head.appendChild(tag);
  });

  return apiPromise;
}

export interface CreatePlayerHandlers {
  onEnded?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
}

/**
 * Mount a player into `el`. Resolves with the player instance once the
 * API is ready. Caller must call `player.destroy()` on unmount.
 */
export async function createPlayer(
  el: HTMLElement,
  videoId: string,
  handlers: CreatePlayerHandlers,
): Promise<YTPlayerInstance> {
  const YT = await loadYouTubeAPI();
  return new YT.Player(el, {
    videoId,
    playerVars: {
      rel: 0, // no related-video rabbit holes at the end
      modestbranding: 1,
    },
    events: {
      onStateChange: (ev) => {
        if (ev.data === YT_STATE.ENDED) handlers.onEnded?.();
        else if (ev.data === YT_STATE.PLAYING) handlers.onPlaying?.();
        else if (ev.data === YT_STATE.PAUSED) handlers.onPaused?.();
      },
    },
  });
}
