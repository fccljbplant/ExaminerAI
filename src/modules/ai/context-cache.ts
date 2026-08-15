import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { decryptPayload, encryptPayload } from "./privacy";

/**
 * modules/ai — context-cache.ts (2026-08-15)
 *
 * Persistent, NAMESPACED, encrypted context cache — the per-subject
 * token caches instructors and tutors use about their students:
 *
 *   course-outline:<courseId>     full weekly/daily outline pack
 *   tutor-topic:<courseId>:<w>:<d> today's lesson slice for the tutor
 *   learner:<userId>:<courseId>   anonymized learner profile pack
 *   cohort:<instructorId>:<courseId> anonymized class summary
 *   project:<userId>:<courseId>   anonymized project context
 *
 * Every hit records how many input tokens the caller would have spent
 * rebuilding + resending the context (estimatedTokens), so the admin
 * panel can show real hit/miss + savings per subject namespace.
 *
 * Payloads are AES-256-GCM encrypted at rest (modules/ai/privacy) and
 * contain pseudonyms only — never names or emails.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function statKey(namespace: string): string {
  return namespace.replace(/[^a-z0-9:._-]/gi, "_");
}

async function recordHit(namespace: string, tokensSaved: number) {
  await db.aICacheStats.upsert({
    where: { namespace },
    update: { hits: { increment: 1 }, tokensSaved: { increment: tokensSaved } },
    create: { namespace, hits: 1, misses: 0, tokensSaved },
  }).catch(() => {});
}

async function recordMiss(namespace: string) {
  await db.aICacheStats.upsert({
    where: { namespace },
    update: { misses: { increment: 1 } },
    create: { namespace, hits: 0, misses: 1, tokensSaved: 0 },
  }).catch(() => {});
}

export interface CachedPack<T> {
  data: T;
}

/**
 * Get-or-build a namespaced, encrypted context pack.
 * `build` returns the data plus how many input tokens feeding this
 * context to the AI would cost (used for the savings ledger).
 */
export async function getOrBuildContextPack<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  build: () => Promise<{ data: T; estimatedTokens: number }>,
): Promise<T> {
  const ns = statKey(namespace);

  const existing = await db.aICache.findUnique({ where: { cacheKey: `${ns}:${key}` } }).catch(() => null);
  if (existing) {
    if (existing.expiresAt && existing.expiresAt.getTime() < Date.now()) {
      await db.aICache.delete({ where: { id: existing.id } }).catch(() => {});
    } else {
      const plain = decryptPayload(existing.response);
      if (plain !== null) {
        await db.aICache.update({
          where: { id: existing.id },
          data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
        }).catch(() => {});
        await recordHit(ns, existing.promptTokens || 0);
        try {
          return JSON.parse(plain) as T;
        } catch {
          // fall through to rebuild on malformed payload
        }
      }
    }
  }

  await recordMiss(ns);
  const built = await build();
  const ttl = ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
  await db.aICache.upsert({
    where: { cacheKey: `${ns}:${key}` },
    update: {
      response: encryptPayload(JSON.stringify(built.data)),
      promptTokens: built.estimatedTokens,
      expiresAt: new Date(Date.now() + ttl),
    },
    create: {
      cacheKey: `${ns}:${key}`,
      response: encryptPayload(JSON.stringify(built.data)),
      provider: "context-pack",
      namespace: ns,
      promptTokens: built.estimatedTokens,
      expiresAt: new Date(Date.now() + ttl),
    },
  }).catch((err) => {
    logger.warn("context-cache write failed", { namespace: ns, error: err instanceof Error ? err.message : String(err) });
  });
  return built.data;
}

/** Drop one namespace (admin "clear" per subject). */
export async function clearNamespace(namespace: string): Promise<number> {
  const ns = statKey(namespace);
  const deleted = await db.aICache.deleteMany({ where: { namespace: ns } });
  await db.aICacheStats.upsert({
    where: { namespace: ns },
    update: { hits: 0, misses: 0, tokensSaved: 0 },
    create: { namespace: ns, hits: 0, misses: 0, tokensSaved: 0 },
  }).catch(() => {});
  return deleted.count;
}

/** Lazily drop expired entries (called from the admin stats endpoint). */
export async function evictExpired(): Promise<number> {
  const deleted = await db.aICache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  }).catch(() => ({ count: 0 }));
  return deleted.count;
}

export interface NamespaceStat {
  namespace: string;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  tokensSaved: number;
}

/** Full per-namespace overview for the admin cache panel. */
export async function getCacheOverview(): Promise<NamespaceStat[]> {
  await evictExpired();
  const [entries, stats] = await Promise.all([
    db.aICache.groupBy({ by: ["namespace"], _count: { _all: true } }),
    db.aICacheStats.findMany({ orderBy: { namespace: "asc" } }),
  ]);
  const byNs = new Map(entries.map((e) => [e.namespace, e._count._all]));

  const namespaces = new Set<string>([...byNs.keys(), ...stats.map((s) => s.namespace)]);
  return [...namespaces].map((ns) => {
    const s = stats.find((x) => x.namespace === ns);
    const hits = s?.hits ?? 0;
    const misses = s?.misses ?? 0;
    const total = hits + misses;
    return {
      namespace: ns,
      entries: byNs.get(ns) ?? 0,
      hits,
      misses,
      hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
      tokensSaved: s?.tokensSaved ?? 0,
    };
  });
}
