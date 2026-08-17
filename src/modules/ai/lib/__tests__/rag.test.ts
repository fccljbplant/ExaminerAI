import { describe, it, expect } from "vitest";
import {
  chunkText,
  cosineSimilarity,
  tokenOverlap,
  topKChunks,
  buildKnowledgeBlock,
  embedText,
} from "../rag";

describe("modules/ai — rag.chunkText", () => {
  it("returns [] for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(chunkText("Hello world", 1200)).toEqual(["Hello world"]);
  });

  it("splits on paragraph boundaries", () => {
    const text = "First paragraph here.\n\nSecond paragraph here.";
    const chunks = chunkText(text, 30);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("First paragraph here.");
    expect(chunks[1]).toBe("Second paragraph here.");
  });

  it("splits a long paragraph on sentence boundaries without exceeding maxChars", () => {
    const text =
      "The quick brown fox jumps over the lazy dog. " +
      "Another sentence about nothing in particular goes here. " +
      "And a third sentence ends the paragraph for good.";
    const chunks = chunkText(text, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80);
      expect(chunk.trim()).not.toBe("");
    }
  });

  it("hard-splits a sentence longer than maxChars", () => {
    const long = "a".repeat(25);
    const chunks = chunkText(long, 10);
    expect(chunks).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
  });

  it("never produces empty chunks and always stays within maxChars", () => {
    const text = `${"word ".repeat(500)}\n\n${"sentence ".repeat(200)}`;
    const chunks = chunkText(text, 100);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it("guards against a non-positive maxChars", () => {
    expect(chunkText("ab cd", 0)).toEqual(["a", "b", " ", "c", "d"]);
  });
});

describe("modules/ai — rag.cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for zero vectors instead of NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([0], [0])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
  });

  it("uses the shorter length when vectors differ in size", () => {
    expect(cosineSimilarity([1, 0, 0, 0], [1, 0])).toBeCloseTo(1);
  });

  it("handles negative values", () => {
    expect(cosineSimilarity([1, -1], [-1, 1])).toBeCloseTo(-1);
  });
});

describe("modules/ai — rag.tokenOverlap", () => {
  it("is 1 for identical text", () => {
    expect(tokenOverlap("database indexing", "database indexing")).toBe(1);
  });

  it("is 0 for disjoint text", () => {
    expect(tokenOverlap("database", "cooking recipes")).toBe(0);
  });

  it("computes Jaccard for partial overlap", () => {
    // A={a,b}, B={b,c} => 1/3
    expect(tokenOverlap("a b", "b c")).toBeCloseTo(1 / 3);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(tokenOverlap("Hello, World!", "world hello")).toBe(1);
  });

  it("returns 0 when either side has no words", () => {
    expect(tokenOverlap("", "some text")).toBe(0);
    expect(tokenOverlap("some text", "!!!")).toBe(0);
  });
});

describe("modules/ai — rag.topKChunks", () => {
  const candidates = [
    { content: "database indexing and b-trees", citation: "A", embedding: [1, 0, 0] },
    { content: "css flexbox layout", citation: "B", embedding: [0, 1, 0] },
    { content: "database query planning", citation: "C", embedding: null },
  ];

  it("ranks by cosine when both embeddings exist", () => {
    const ranked = topKChunks([1, 0, 0], "unused", candidates, 5);
    expect(ranked[0].citation).toBe("A");
    expect(ranked[0].score).toBeCloseTo(1);
  });

  it("falls back to token overlap when the query embedding is null", () => {
    const ranked = topKChunks(null, "database indexing", candidates, 5);
    expect(ranked[0].citation).toBe("A");
    expect(ranked[1].citation).toBe("C");
    expect(ranked[2].citation).toBe("B");
  });

  it("respects k", () => {
    const ranked = topKChunks(null, "database", candidates, 1);
    expect(ranked).toHaveLength(1);
  });

  it("handles empty candidate list", () => {
    expect(topKChunks([1, 0], "anything", [], 5)).toEqual([]);
  });
});

describe("modules/ai — rag.buildKnowledgeBlock", () => {
  it("formats numbered citations with content", () => {
    const block = buildKnowledgeBlock([
      { citation: "Week 1 Day 1 · Slide 2", content: "Content one." },
      { citation: "Material: Slides.pdf", content: "Content two." },
    ]);
    expect(block).toContain("COURSE KNOWLEDGE BASE (sourced excerpts):");
    expect(block).toContain("[1] Citation: Week 1 Day 1 · Slide 2");
    expect(block).toContain("Content one.");
    expect(block).toContain("[2] Citation: Material: Slides.pdf");
    expect(block).toContain("Content two.");
  });

  it("handles empty chunks", () => {
    const block = buildKnowledgeBlock([]);
    expect(block).toBe("COURSE KNOWLEDGE BASE (sourced excerpts):");
  });
});

describe("modules/ai — rag.embedText", () => {
  it("returns null immediately for empty input (no network call)", async () => {
    await expect(embedText("   ")).resolves.toBeNull();
  });
});
