/**
 * modules/submission/lib/ai-packet.ts — W4 text-only AI context packet
 * (REDESIGN-P4 §1, P2 §3.4)
 *
 * Every AI call site in the submission subsystem builds its context through
 * here. Binaries never cross into prompts: photos/videos are reduced to
 * their file names + learner-provided descriptions; only extractedText and
 * learnerSummary flow into the packet.
 */

import type { PartView } from "../contracts";

export interface AiContextPacket {
  /** Flat, delimited text safe to embed in a prompt. */
  asPromptText: string;
  /** Approximate token count (4 chars/token heuristic). */
  approxTokens: number;
  partCount: number;
}

/**
 * Build the packet from a submission's parts. `maxChars` guards the total
 * budget — parts are truncated in order, earliest first.
 */
export function buildSubmissionPacket(
  parts: PartView[],
  learnerSummary: string,
  maxChars = 60_000,
): AiContextPacket {
  const sections: string[] = [];
  if (learnerSummary.trim()) {
    sections.push(`LEARNER SUMMARY:\n${learnerSummary.trim()}`);
  }
  for (const p of parts) {
    switch (p.type) {
      case "text":
        if (p.text?.trim()) sections.push(`TEXT PART:\n${p.text.trim()}`);
        break;
      case "link":
        if (p.url) sections.push(`LINK PART: ${p.url}`);
        break;
      case "checklist":
        if (p.checklist?.length) {
          const items = p.checklist
            .map((c) => `- [${c.checked ? "x" : " "}] ${c.label}`)
            .join("\n");
          sections.push(`CHECKLIST PART:\n${items}`);
        }
        break;
      case "file":
        sections.push(
          `FILE PART: ${p.fileName ?? "document"}${
            p.extractedText?.trim()
              ? `\nEXTRACTED TEXT:\n${p.extractedText.trim()}`
              : "\n(no extracted text — extraction failed or pending)"
          }`,
        );
        break;
      case "photo":
      case "video":
        // Binary — filename/URL only, never the bytes.
        sections.push(
          `${p.type.toUpperCase()} PART: ${p.fileName ?? p.url ?? "(no reference)"}`,
        );
        break;
    }
  }

  const joined = sections.join("\n\n");
  const asPromptText =
    joined.length > maxChars ? `${joined.slice(0, maxChars)}\n\n[truncated]` : joined;

  return {
    asPromptText,
    approxTokens: Math.ceil(asPromptText.length / 4),
    partCount: parts.length,
  };
}
