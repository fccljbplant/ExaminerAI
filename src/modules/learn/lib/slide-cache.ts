// src/modules/learn/lib/slide-cache.ts — browser-memory slide cache.
/**
 * Client-only cache for generated topic slides.
 *
 * Slides of ONE topic are cached in browser memory (a module-level Map
 * plus a sessionStorage mirror so they survive a refresh within the same
 * tab session). Re-learning a previously learned topic loads instantly
 * from the cache while the server copy is authoritative long-term.
 *
 * Only imported from client components — never from server routes.
 */

import type { SlideData } from "../types";

const MEM_CACHE = new Map<string, SlideData[]>();
const STORAGE_PREFIX = "ta-slides:";
const MAX_STORED_TOPICS = 30;

function topicKey(courseId: string, week: number, day: number): string {
  return `${courseId}:${week}-${day}`;
}

function readStorage(key: string): SlideData[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SlideData[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, slides: SlideData[]): void {
  try {
    // Keep the store bounded: drop the oldest keys past the cap.
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    if (keys.length >= MAX_STORED_TOPICS && !keys.includes(STORAGE_PREFIX + key)) {
      const oldest = keys[0];
      if (oldest) sessionStorage.removeItem(oldest);
    }
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(slides));
  } catch {
    /* private browsing / quota — memory cache still works */
  }
}

/** Cached slides for a topic, or null when not cached. */
export function getCachedSlides(
  courseId: string,
  week: number,
  day: number,
): SlideData[] | null {
  const key = topicKey(courseId, week, day);
  const mem = MEM_CACHE.get(key);
  if (mem) return mem;
  const stored = readStorage(key);
  if (stored) MEM_CACHE.set(key, stored);
  return stored;
}

/** Store the slides of one topic in browser memory. */
export function cacheSlides(
  courseId: string,
  week: number,
  day: number,
  slides: SlideData[],
): void {
  const key = topicKey(courseId, week, day);
  MEM_CACHE.set(key, slides);
  writeStorage(key, slides);
}
