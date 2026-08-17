/**
 * modules/ai/lib/rag-db.ts — course knowledge indexing + retrieval.
 *
 * indexCourse() collects every textual course source (slides, course
 * days, narrations, materials), chunks them, embeds the first batch
 * (capped so a reindex never fires thousands of API calls), and
 * rebuilds the CourseEmbedding table for the course.
 *
 * retrieveForQuery() loads the stored chunks, embeds the query, and
 * ranks via rag.topKChunks (cosine when embeddings exist, keyword
 * overlap otherwise).
 *
 * getFullCourseSlidesBlock() reproduces the legacy full-course
 * prompt-stuffing block (the shape /api/learn/sessions/[id]/ask used
 * before RAG) — the fallback when retrieval returns nothing useful.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { chunkText, embedText, topKChunks, type RankedChunk } from "./rag";

/** How many chunks get embedded per reindex — beyond this the chunks are
 *  stored with embeddingJson null and covered by the keyword fallback. */
const EMBED_BATCH_LIMIT = 100;
const CHUNK_MAX_CHARS = 1200;
const EMBEDDING_ROW_LIMIT = 200;

export interface IndexResult {
  indexed: number;
  withEmbeddings: number;
}

interface SourceDraft {
  sourceType: "slide" | "day" | "material" | "narration";
  sourceId: string;
  moduleId: string | null;
  content: string;
  citation: string;
}

/** Parse a "{week}-{day}" moduleId into its numeric parts. */
function parseModuleId(moduleId: string | null): { w: number | null; d: number | null } {
  if (!moduleId) return { w: null, d: null };
  const parts = moduleId.split("-");
  const w = Number.parseInt(parts[0] ?? "", 10);
  const d = Number.parseInt(parts[1] ?? "", 10);
  return {
    w: Number.isFinite(w) ? w : null,
    d: Number.isFinite(d) ? d : null,
  };
}

/** `Week {w} Day {d} · Slide {n}` — the citation format for slides. */
function slideCitation(moduleId: string | null, slideOrder: number): string {
  const { w, d } = parseModuleId(moduleId);
  if (w !== null && d !== null) return `Week ${w} Day ${d} · Slide ${slideOrder}`;
  return `Slide ${slideOrder}`;
}

/** String[] from a JSON column (bullets / keyTerms / topicsCovered). */
function safeStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string");
}

/** Collect every indexable source for a course. */
async function collectSources(courseId: string): Promise<SourceDraft[]> {
  const sources: SourceDraft[] = [];

  // 1. Slides (+ their narrations).
  const slides = await db.learnSlide.findMany({
    where: { courseId },
    orderBy: { slideOrder: "asc" },
    include: { narrations: true },
  });
  for (const slide of slides) {
    const bullets = safeStringArray(slide.bullets);
    const keyTerms = safeStringArray(slide.keyTerms);
    const content = [
      slide.title,
      ...bullets,
      ...(keyTerms.length ? [`Key terms: ${keyTerms.join(", ")}`] : []),
      ...(slide.analogy ? [`Analogy: ${slide.analogy}`] : []),
      ...(slide.realWorldExample ? [`Real-world example: ${slide.realWorldExample}`] : []),
    ]
      .filter(Boolean)
      .join("\n");
    if (content.trim()) {
      sources.push({
        sourceType: "slide",
        sourceId: slide.id,
        moduleId: slide.moduleId,
        content,
        citation: slideCitation(slide.moduleId, slide.slideOrder),
      });
    }
    for (const narration of slide.narrations) {
      if (narration.text.trim()) {
        sources.push({
          sourceType: "narration",
          sourceId: narration.id,
          moduleId: slide.moduleId,
          content: narration.text,
          citation: slideCitation(slide.moduleId, slide.slideOrder),
        });
      }
    }
  }

  // 2. Course days (title + objective + activity + deliverable + topics).
  const weeks = await db.courseWeek.findMany({
    where: { courseId },
    include: { days: { orderBy: { day: "asc" } } },
  });
  for (const week of weeks) {
    for (const day of week.days) {
      let topics: string[] = [];
      try {
        topics = safeStringArray(JSON.parse(day.topicsCovered));
      } catch {
        topics = [];
      }
      const content = [
        day.title,
        day.objective,
        day.activity,
        day.deliverable,
        ...(topics.length ? [`Topics covered: ${topics.join(", ")}`] : []),
      ]
        .filter(Boolean)
        .join("\n");
      if (!content.trim()) continue;
      sources.push({
        sourceType: "day",
        sourceId: day.id,
        moduleId: `${week.weekNumber}-${day.day}`,
        content,
        citation: `Week ${week.weekNumber} Day ${day.day}`,
      });
    }
  }

  // 3. Course materials.
  const materials = await db.courseMaterial.findMany({ where: { courseId } });
  for (const material of materials) {
    if (!material.content.trim()) continue;
    sources.push({
      sourceType: "material",
      sourceId: material.id,
      moduleId: null,
      content: material.content,
      citation: `Material: ${material.title}`,
    });
  }

  return sources;
}

/** Parse a stored embeddingJson back into a number[] (or null). */
function parseEmbedding(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "number")) {
      return parsed as number[];
    }
    return null;
  } catch {
    return null;
  }
}

/** Rebuild the CourseEmbedding rows for a course from all sources.
 *  Deletes existing rows first, then createMany's the fresh set.
 *  Returns the number of rows written and how many carry embeddings. */
export async function indexCourse(courseId: string): Promise<IndexResult> {
  const sources = await collectSources(courseId);

  // Chunk everything up-front so chunkIndex is stable.
  const chunks: { source: SourceDraft; content: string }[] = [];
  for (const source of sources) {
    for (const piece of chunkText(source.content, CHUNK_MAX_CHARS)) {
      chunks.push({ source, content: piece.slice(0, 8000) });
    }
  }

  // Embed the first EMBED_BATCH_LIMIT chunks; the rest stay keyword-only.
  const embeddings: (number[] | null)[] = new Array(chunks.length).fill(null);
  let withEmbeddings = 0;
  for (let i = 0; i < Math.min(chunks.length, EMBED_BATCH_LIMIT); i++) {
    const vector = await embedText(chunks[i].content);
    if (vector) {
      embeddings[i] = vector;
      withEmbeddings++;
    }
  }

  await db.courseEmbedding.deleteMany({ where: { courseId } });
  if (chunks.length > 0) {
    await db.courseEmbedding.createMany({
      data: chunks.map((chunk, i) => ({
        courseId,
        moduleId: chunk.source.moduleId,
        sourceType: chunk.source.sourceType,
        sourceId: chunk.source.sourceId,
        chunkIndex: i,
        content: chunk.content,
        citation: chunk.source.citation,
        embeddingJson: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
      })),
    });
  }

  return { indexed: chunks.length, withEmbeddings };
}

/** Retrieve the top-k most relevant chunks for a query over a course. */
export async function retrieveForQuery(
  courseId: string,
  query: string,
  k: number = 5,
): Promise<RankedChunk[]> {
  const rows = await db.courseEmbedding.findMany({
    where: { courseId },
    orderBy: { chunkIndex: "asc" },
    take: EMBEDDING_ROW_LIMIT,
  });
  if (rows.length === 0) return [];

  const queryEmbedding = await embedText(query);
  return topKChunks(
    queryEmbedding,
    query,
    rows.map((row) => ({
      content: row.content,
      citation: row.citation,
      embedding: parseEmbedding(row.embeddingJson),
    })),
    k,
  );
}

/** Legacy full-course prompt-stuffing block — the exact shape the
 *  sessions-ask route used before RAG. Used when retrieval returns
 *  nothing useful. */
export async function getFullCourseSlidesBlock(courseId: string): Promise<string> {
  try {
    const slides = await db.learnSlide.findMany({
      where: { courseId },
      orderBy: { slideOrder: "asc" },
    });
    const blocks = slides.map((slide) => {
      const meta = slide.moduleId ?? "0-0"; // "{week}-{day}"
      const [w, d] = meta.split("-");
      const citation = `[Week ${w}/Day ${d}/Slide ${slide.slideOrder}]`;
      const bullets = safeStringArray(slide.bullets).map((b) => `  • ${b}`).join("\n");
      const keyTerms = safeStringArray(slide.keyTerms).length
        ? `Key terms: ${safeStringArray(slide.keyTerms).join(", ")}`
        : "";
      const analogy = slide.analogy ? `Analogy: ${slide.analogy}` : "";
      const rwe = slide.realWorldExample ? `Real-world example: ${slide.realWorldExample}` : "";
      return `${citation} ${slide.title}\n${bullets}${keyTerms ? "\n" + keyTerms : ""}${analogy ? "\n" + analogy : ""}${rwe ? "\n" + rwe : ""}`;
    });
    return (
      blocks.join("\n\n---\n\n") ||
      "(The tutor is preparing slides for this topic — answer from general knowledge and cite the topic.)"
    );
  } catch (err) {
    logger.error("getFullCourseSlidesBlock failed", {
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "(The tutor is preparing slides for this topic — answer from general knowledge and cite the topic.)";
  }
}

/** Keyword fallback path: returns the legacy full-course block. The
 *  `query` parameter is accepted for signature stability with future
 *  keyword-ranked fallbacks. */
export async function keywordFallbackBlock(courseId: string, query: string): Promise<string> {
  void query;
  return getFullCourseSlidesBlock(courseId);
}
