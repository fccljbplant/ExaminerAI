/**
 * modules/submission/lib/text-extract.ts — W4 text-extraction pipeline
 * (REDESIGN-P4 §6)
 *
 * docx via mammoth, pdf via pdfjs-dist — both open-source and on-server,
 * no paid/external service. Hard limits + a 10s budget per job; any failure
 * degrades to EXTRACTION_FAILED (human-only review path, P2 §3.4) instead
 * of blocking the learner.
 *
 * The parsers are imported dynamically so a missing/broken package degrades
 * at runtime rather than breaking the build.
 */

// ── Limits (P4 §6) ───────────────────────────────────────────────────────

export const EXTRACT_LIMITS = {
  docxMaxBytes: 5 * 1024 * 1024,
  pdfMaxBytes: 10 * 1024 * 1024,
  pdfMaxPages: 200,
  timeoutMs: 10_000,
  /** ~20k tokens ≈ 80k chars (4 chars/token heuristic). */
  maxChars: 80_000,
} as const;

export type ExtractStatus = "done" | "failed";

export interface ExtractResult {
  status: ExtractStatus;
  text: string;
  /** Machine-readable failure reason (typed error surface). */
  reason?: "oversize" | "unsupported_mime" | "too_many_pages" | "timeout" | "parser_error";
  truncated: boolean;
}

// ── Pure helpers ─────────────────────────────────────────────────────────

/** Which parser (if any) handles this mime type. */
export function routeByMime(mime: string): "docx" | "pdf" | "text" | null {
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return null;
}

/** Enforce the size limit for a parser kind. */
export function withinSizeLimit(kind: "docx" | "pdf", sizeBytes: number): boolean {
  return sizeBytes <= (kind === "docx" ? EXTRACT_LIMITS.docxMaxBytes : EXTRACT_LIMITS.pdfMaxBytes);
}

/** Truncate to ~20k tokens, collapsing whitespace runs. */
export function truncateExtracted(raw: string): { text: string; truncated: boolean } {
  const collapsed = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (collapsed.length <= EXTRACT_LIMITS.maxChars) {
    return { text: collapsed, truncated: false };
  }
  return {
    text: collapsed.slice(0, EXTRACT_LIMITS.maxChars),
    truncated: true,
  };
}

/** Reject a promise after `ms` without leaking the timer on success. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("EXTRACT_TIMEOUT")), ms);
      // Node keeps the process alive until the timer clears — drop it once
      // the race settles either way.
      promise.finally(() => clearTimeout(timer)).catch(() => undefined);
    }),
  ]);
}

// ── Parsers ──────────────────────────────────────────────────────────────

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  // mammoth's typing requires a Node Buffer.
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Legacy build = pure Node (no DOM/worker requirements).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  if (doc.numPages > EXTRACT_LIMITS.pdfMaxPages) {
    throw new Error("EXTRACT_TOO_MANY_PAGES");
  }
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    chunks.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );
    page.cleanup();
  }
  return chunks.join("\n\n");
}

// ── Core ─────────────────────────────────────────────────────────────────

/**
 * Extract text from an uploaded document. Never throws — every failure
 * path returns { status: "failed" } so the caller can record
 * extractionStatus = failed and continue with human-only review.
 */
export async function extractText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractResult> {
  const kind = routeByMime(mimeType);

  if (kind === null) {
    return {
      status: "failed",
      text: "",
      reason: "unsupported_mime",
      truncated: false,
    };
  }
  if (kind === "text") {
    const decoded = new TextDecoder().decode(bytes);
    return { status: "done", ...truncateExtracted(decoded) };
  }
  if (!withinSizeLimit(kind, bytes.byteLength)) {
    return { status: "failed", text: "", reason: "oversize", truncated: false };
  }

  try {
    const raw = await withTimeout(
      kind === "docx" ? extractDocx(bytes) : extractPdf(bytes),
      EXTRACT_LIMITS.timeoutMs,
    );
    return { status: "done", ...truncateExtracted(raw) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "EXTRACT_TIMEOUT") {
      return { status: "failed", text: "", reason: "timeout", truncated: false };
    }
    if (message === "EXTRACT_TOO_MANY_PAGES") {
      return {
        status: "failed",
        text: "",
        reason: "too_many_pages",
        truncated: false,
      };
    }
    // Missing package, corrupt file, parser crash — same degradation.
    return { status: "failed", text: "", reason: "parser_error", truncated: false };
  }
}
