/**
 * modules/ai/lib/rag.ts — RAG primitives for course knowledge retrieval.
 *
 * Pure, dependency-light helpers (chunking, cosine similarity, keyword
 * overlap, ranking, knowledge-block formatting) plus the embedding
 * client. embedText() talks to the OpenAI-compatible Z.ai embeddings
 * endpoint DIRECTLY (env-only key) so this module never imports from
 * @/modules/assessment/lib/ai-provider — avoiding an import cycle
 * between the AI data layer and the provider.
 *
 * Everything here degrades gracefully:
 *   - embedText returns null on any failure (no key, network error,
 *     empty model output) so callers fall back to keyword ranking.
 *   - topKChunks ranks by token overlap whenever either embedding is
 *     missing.
 */

import OpenAI from "openai";

// === 1. Chunking ===========================================================

/** Split `text` into chunks of at most `maxChars` characters, preferring
 *  paragraph and sentence boundaries. Chunks are never empty strings;
 *  empty/whitespace input returns []. A sentence longer than maxChars is
 *  hard-split into maxChars pieces. */
export function chunkText(text: string, maxChars: number = 1200): string[] {
  const raw = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const safeMax = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 1;

  const chunks: string[] = [];
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (paragraph.length <= safeMax) {
      chunks.push(paragraph);
      continue;
    }

    // Long paragraph: split on sentence boundaries, then group.
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let current = "";
    for (const sentence of sentences) {
      if (sentence.length > safeMax) {
        // Flush the running chunk, then hard-split the long sentence.
        if (current) {
          chunks.push(current);
          current = "";
        }
        for (let i = 0; i < sentence.length; i += safeMax) {
          chunks.push(sentence.slice(i, i + safeMax));
        }
        continue;
      }
      const merged = current ? `${current} ${sentence}` : sentence;
      if (merged.length > safeMax && current) {
        chunks.push(current);
        current = sentence;
      } else {
        current = merged;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks;
}

// === 2. Similarity ========================================================

/** Cosine similarity between two vectors. Zero vectors (or mismatched/
 *  empty vectors) return 0 instead of NaN. Uses the shorter length when
 *  the vectors differ in size. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(sim) ? sim : 0;
}

/** Lowercase word sets for a text (alphanumeric + underscore/apostrophe). */
function tokenize(text: string): Set<string> {
  const words = (text ?? "").toLowerCase().match(/[a-z0-9_']+/g) ?? [];
  return new Set(words);
}

/** Jaccard similarity between the word sets of `query` and `chunk`
 *  (intersection / union). The keyword fallback used when embeddings are
 *  unavailable. Returns 0 when either side has no words. */
export function tokenOverlap(query: string, chunk: string): number {
  const a = tokenize(query);
  const b = tokenize(chunk);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// === 3. Embeddings ========================================================

const EMBEDDING_BASE_URL = "https://api.z.ai/api/paas/v4";

let _embedClient: OpenAI | null = null;
let _embedKey: string | null = null;

/** Embed `text` via the OpenAI-compatible Z.ai embeddings endpoint.
 *  Key comes from env only (ZAI_API_KEY, falling back to DEEPSEEK_API_KEY)
 *  — never from the DB — to keep this module free of db imports.
 *  Returns null on ANY failure (missing key, network, empty output). */
export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.ZAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const trimmed = (text ?? "").trim();
  if (!key || !trimmed) return null;
  try {
    if (!_embedClient || _embedKey !== key) {
      _embedClient = new OpenAI({ apiKey: key, baseURL: EMBEDDING_BASE_URL });
      _embedKey = key;
    }
    const model = process.env.ZAI_EMBEDDING_MODEL ?? "embedding-3";
    const response = await _embedClient.embeddings.create({ model, input: trimmed });
    const vector = response.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length > 0 ? vector : null;
  } catch {
    return null;
  }
}

// === 4. Ranking ===========================================================

export interface RagCandidate {
  content: string;
  citation: string;
  embedding: number[] | null;
}

export interface RankedChunk {
  content: string;
  citation: string;
  score: number;
}

/** Rank candidates: cosine similarity when both the query embedding and
 *  the candidate embedding exist, otherwise tokenOverlap on the raw
 *  text. Returns the top `k` (default 5), sorted by descending score. */
export function topKChunks(
  queryEmbedding: number[] | null,
  queryText: string,
  candidates: RagCandidate[],
  k: number = 5,
): RankedChunk[] {
  const ranked = candidates.map((c) => {
    let score: number;
    if (
      Array.isArray(queryEmbedding) &&
      queryEmbedding.length > 0 &&
      Array.isArray(c.embedding) &&
      c.embedding.length > 0
    ) {
      score = cosineSimilarity(queryEmbedding, c.embedding);
    } else {
      score = tokenOverlap(queryText, c.content);
    }
    return { content: c.content, citation: c.citation, score };
  });
  return ranked
    .sort((x, y) => y.score - x.score)
    .slice(0, Math.max(0, Math.floor(k)));
}

// === 5. Knowledge block ===================================================

/** Format ranked chunks into the tutor's knowledge-base block:
 *
 *   COURSE KNOWLEDGE BASE (sourced excerpts):
 *   [1] Citation: Week 2 Day 3 · Slide 2
 *   <content>
 *   [2] Citation: ...
 *   <content>
 */
export function buildKnowledgeBlock(chunks: { content: string; citation: string }[]): string {
  const lines = ["COURSE KNOWLEDGE BASE (sourced excerpts):"];
  chunks.forEach((chunk, i) => {
    lines.push(`[${i + 1}] Citation: ${chunk.citation}`, chunk.content.trim());
  });
  return lines.join("\n");
}
