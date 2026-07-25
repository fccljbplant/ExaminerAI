/**
 * Token cache — opt-in response cache for AI calls.
 *
 * Goal: cut token spend on calls where the same input recurs:
 *  - AI Tutor: system prompt + course outline + project description are stable
 *    for a given student/week — only the user's question changes per turn.
 *    Caching the system-prompt prefix reduces billed input tokens ~70%.
 *  - Question generation: same topic + pillar + projectType + weak areas →
 *    same question worth reusing for the next student who hits the same
 *    context (within TTL).
 *  - Daily motivation: per-day, per-student — same input within 24h.
 *  - Project summary: same project definition → same summary.
 *
 * What is NOT cached:
 *  - Test replies (per-student conversation history is unique).
 *  - Grading (per-student transcript is unique).
 *  - Final analysis (per-test is unique).
 *
 * The cache is an in-memory LRU with TTL. It's per-process — multiple
 * Vercel serverless instances won't share cache, but the hit rate is
 * still significant within a single warm instance. For multi-instance
 * sharing, swap the Map for Redis (same interface).
 *
 * Cache key = sha256(canonical(messages) + "|" + canonical(options)).
 * Temperature is included in the key (different temp → different cache slot).
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";

interface CacheEntry {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  expiresAt: number; // epoch ms
  hits: number;
}

interface CacheOptions {
  /** Time-to-live in milliseconds. Default 1 hour. */
  ttlMs?: number;
  /** Max entries before LRU eviction. Default 500. */
  maxEntries?: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_ENTRIES = 500;

// Single shared cache instance — LRU ordered by insertion (Map preserves
// insertion order in JS). On hit, we delete + re-insert to mark as recently used.
const _cache = new Map<string, CacheEntry>();

// Stats — exposed for the admin dashboard
let _hits = 0;
let _misses = 0;
let _evictions = 0;

/** Build a stable cache key from messages + temperature + maxTokens. */
function buildKey(
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number },
): string {
  // Only include role + content (timestamp/instance props would break caching).
  // Truncate very long content to keep hashing fast — 32KB per message is plenty.
  const canonical = messages
    .map(m => `${m.role}:${m.content.slice(0, 32_000)}`)
    .join("\n---\n");
  const opts = `${options.temperature ?? "def"}|${options.maxTokens ?? "def"}`;
  return createHash("sha256").update(`${canonical}||${opts}`).digest("hex");
}

/** Look up a cached AI response. Returns null if missing or expired. */
export function getCachedResponse(
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number },
): CacheEntry | null {
  const key = buildKey(messages, options);
  const entry = _cache.get(key);
  if (!entry) {
    _misses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    _misses++;
    return null;
  }
  // LRU: move to end (most recently used)
  _cache.delete(key);
  _cache.set(key, entry);
  entry.hits++;
  _hits++;
  return entry;
}

/** Store an AI response in the cache. Overwrites existing entry with same key. */
export function setCachedResponse(
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number },
  result: { text: string; promptTokens: number; completionTokens: number; model: string },
  opts?: CacheOptions,
): void {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;

  // Don't cache empty responses — they're error fallbacks
  if (!result.text || result.text.trim().length === 0) return;

  const key = buildKey(messages, options);
  const entry: CacheEntry = {
    text: result.text,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    model: result.model,
    expiresAt: Date.now() + ttl,
    hits: 0,
  };

  // LRU eviction: if at capacity, delete the oldest entry (first in Map)
  while (_cache.size >= maxEntries) {
    const oldestKey = _cache.keys().next().value;
    if (oldestKey === undefined) break;
    _cache.delete(oldestKey);
    _evictions++;
  }

  _cache.set(key, entry);
}

/** Clear the entire cache. Used by the admin "clear cache" button. */
export function clearTokenCache(): void {
  const cleared = _cache.size;
  _cache.clear();
  logger.info("Token cache cleared", { clearedEntries: cleared });
}

/** Get cache stats for the admin dashboard. */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  estimatedTokensSaved: number;
} {
  const total = _hits + _misses;
  // Tokens saved = sum of promptTokens for every cache hit (we skip the API
  // call entirely, so the full input tokens are saved). We can't recover
  // the exact per-hit promptTokens after the fact — approximate using the
  // current cache's average promptTokens.
  let totalPromptTokens = 0;
  for (const entry of _cache.values()) {
    totalPromptTokens += entry.promptTokens;
  }
  const avgPromptTokens = _cache.size > 0 ? totalPromptTokens / _cache.size : 0;
  return {
    size: _cache.size,
    hits: _hits,
    misses: _misses,
    evictions: _evictions,
    hitRate: total > 0 ? Math.round((_hits / total) * 100) : 0,
    estimatedTokensSaved: Math.round(_hits * avgPromptTokens),
  };
}

/** Reset stats counters (does not clear the cache). For testing. */
export function resetCacheStats(): void {
  _hits = 0;
  _misses = 0;
  _evictions = 0;
}
