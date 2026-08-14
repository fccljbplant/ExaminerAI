/**
 * Tests for src/modules/submission/lib/text-extract.ts (pure extraction helpers).
 *
 * Covers REDESIGN-P4 §6: mime routing, size limits, whitespace-collapsing
 * truncation, and the never-throw degradation contract of extractText.
 */

import { describe, it, expect } from "vitest";
import {
  EXTRACT_LIMITS,
  routeByMime,
  withinSizeLimit,
  truncateExtracted,
  withTimeout,
  extractText,
} from "../lib/text-extract";

describe("routeByMime", () => {
  it("routes docx and pdf mimes", () => {
    expect(
      routeByMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(routeByMime("application/pdf")).toBe("pdf");
  });

  it("routes text/* to text", () => {
    expect(routeByMime("text/plain")).toBe("text");
    expect(routeByMime("text/markdown")).toBe("text");
  });

  it("returns null for unsupported mimes", () => {
    expect(routeByMime("image/png")).toBeNull();
    expect(routeByMime("video/mp4")).toBeNull();
  });
});

describe("withinSizeLimit", () => {
  it("enforces the docx 5MB limit", () => {
    expect(withinSizeLimit("docx", EXTRACT_LIMITS.docxMaxBytes)).toBe(true);
    expect(withinSizeLimit("docx", EXTRACT_LIMITS.docxMaxBytes + 1)).toBe(false);
  });

  it("enforces the pdf 10MB limit", () => {
    expect(withinSizeLimit("pdf", EXTRACT_LIMITS.pdfMaxBytes)).toBe(true);
    expect(withinSizeLimit("pdf", EXTRACT_LIMITS.pdfMaxBytes + 1)).toBe(false);
  });
});

describe("truncateExtracted", () => {
  it("collapses whitespace runs and trims", () => {
    const { text, truncated } = truncateExtracted("  hello   world\n\n\n\n\nnext  ");
    expect(text).toBe("hello world\n\nnext");
    expect(truncated).toBe(false);
  });

  it("truncates long text and flags it", () => {
    const { text, truncated } = truncateExtracted("x".repeat(EXTRACT_LIMITS.maxChars + 500));
    expect(text.length).toBe(EXTRACT_LIMITS.maxChars);
    expect(truncated).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves with the underlying value", async () => {
    await expect(withTimeout(Promise.resolve(42), 100)).resolves.toBe(42);
  });

  it("rejects with EXTRACT_TIMEOUT when the promise is still pending", async () => {
    const never = new Promise<never>(() => undefined);
    await expect(withTimeout(never, 5)).rejects.toThrow("EXTRACT_TIMEOUT");
  });
});

describe("extractText", () => {
  it("decodes text/* in place", async () => {
    const result = await extractText(new TextEncoder().encode("plain text"), "text/plain");
    expect(result.status).toBe("done");
    expect(result.text).toBe("plain text");
  });

  it("degrades to failed for unsupported mimes", async () => {
    const result = await extractText(new Uint8Array([1, 2, 3]), "image/png");
    expect(result).toMatchObject({ status: "failed", reason: "unsupported_mime" });
  });

  it("degrades to failed for an oversized docx (no parser invocation)", async () => {
    const big = new Uint8Array(EXTRACT_LIMITS.docxMaxBytes + 1);
    const result = await extractText(
      big,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result).toMatchObject({ status: "failed", reason: "oversize" });
  });
});
