// src/modules/learn/lib/lesson-media.ts — Lesson media resolver (isomorphic).
/**
 * Decides what the classroom stage shows for a topic: a curated video
 * lesson, a video discovered in the topic's resources, or slides only.
 *
 * Resolver order (first match wins):
 *   1. CURATED_VIDEOS — hand-picked embed per topic title (instructor-grade)
 *   2. First YouTube URL in topic.resources
 *   3. Slides only
 *
 * This file is isomorphic (no db, no window) — safe on server and client.
 */

import type { TopicContext } from "../types";

export interface LessonVideo {
  provider: "youtube";
  videoId: string;
  title: string;
}

export interface LessonMedia {
  kind: "video" | "slides";
  video?: LessonVideo;
}

/**
 * Hand-picked videos keyed by exact topic title (lowercase).
 * Instructors curate the best explainer for a topic here — this beats
 * the resources fallback, which may link to long or off-syllabus videos.
 */
const CURATED_VIDEOS: Record<string, LessonVideo> = {
  // "what are large language models?": {
  //   provider: "youtube",
  //   videoId: "wjZofJX0v4M",
  //   title: "3Blue1Brown: GPT visual intro",
  // },
};

/** Extract an 11-char YouTube video ID from any common URL shape. */
export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?[^#]*v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Resolve the lesson media for a topic. Pure — safe to call from the
 * /api/learn/today route (server) and from stage components (client).
 */
export function getLessonMedia(topic: TopicContext): LessonMedia {
  const curated = CURATED_VIDEOS[topic.title.toLowerCase()];
  if (curated) return { kind: "video", video: curated };

  for (const r of topic.resources ?? []) {
    const videoId = parseYouTubeId(r.url);
    if (videoId) {
      return { kind: "video", video: { provider: "youtube", videoId, title: r.label } };
    }
  }

  return { kind: "slides" };
}
