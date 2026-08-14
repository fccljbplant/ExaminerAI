/**
 * Tests for src/modules/submission/lib/ai-packet.ts (text-only AI packet).
 *
 * Proves the P2 §3.4 hard constraint: binaries (photo/video) never enter the
 * prompt — only extractedText, learnerSummary, and structured metadata flow
 * into the AI context packet.
 */

import { describe, it, expect } from "vitest";
import type { PartView } from "../contracts";
import { buildSubmissionPacket } from "../lib/ai-packet";

function part(overrides: Partial<PartView>): PartView {
  return {
    id: "p1",
    type: "text",
    text: null,
    url: null,
    fileName: null,
    mimeType: null,
    sizeBytes: null,
    dataUrl: null,
    extractedText: null,
    extractionStatus: "none",
    checklist: null,
    ...overrides,
  };
}

describe("buildSubmissionPacket", () => {
  it("includes the learner summary", () => {
    const packet = buildSubmissionPacket([], "Here is what I did");
    expect(packet.asPromptText).toContain("LEARNER SUMMARY:\nHere is what I did");
  });

  it("includes text, link, and checklist parts", () => {
    const packet = buildSubmissionPacket(
      [
        part({ type: "text", text: "My answer" }),
        part({ type: "link", url: "https://store.example.com" }),
        part({
          type: "checklist",
          checklist: [
            { label: "First", checked: true },
            { label: "Second", checked: false },
          ],
        }),
      ],
      "",
    );
    expect(packet.asPromptText).toContain("TEXT PART:\nMy answer");
    expect(packet.asPromptText).toContain("LINK PART: https://store.example.com");
    expect(packet.asPromptText).toContain("- [x] First");
    expect(packet.asPromptText).toContain("- [ ] Second");
  });

  it("includes extracted text for files", () => {
    const packet = buildSubmissionPacket(
      [part({ type: "file", fileName: "report.docx", extractedText: "Extracted body" })],
      "",
    );
    expect(packet.asPromptText).toContain("FILE PART: report.docx");
    expect(packet.asPromptText).toContain("EXTRACTED TEXT:\nExtracted body");
  });

  it("flags a file with no extracted text", () => {
    const packet = buildSubmissionPacket(
      [part({ type: "file", fileName: "report.docx" })],
      "",
    );
    expect(packet.asPromptText).toContain("(no extracted text");
  });

  it("never embeds binary bytes for photo/video — reference only", () => {
    const packet = buildSubmissionPacket(
      [
        part({ type: "photo", fileName: "evidence.jpg", dataUrl: "data:image/jpeg;base64,AAAA" }),
        part({ type: "video", url: "https://cdn/x.mp4" }),
      ],
      "summary",
    );
    // No base64 bytes may cross into the prompt.
    expect(packet.asPromptText).not.toContain("base64");
    expect(packet.asPromptText).not.toContain("AAAA");
    expect(packet.asPromptText).toContain("PHOTO PART: evidence.jpg");
    expect(packet.asPromptText).toContain("VIDEO PART: https://cdn/x.mp4");
  });

  it("truncates to the max char budget and marks truncation", () => {
    const long = "a".repeat(200);
    const packet = buildSubmissionPacket([part({ type: "text", text: long })], "", 50);
    expect(packet.asPromptText.length).toBeLessThanOrEqual(50 + "[truncated]".length + 2);
    expect(packet.asPromptText).toContain("[truncated]");
  });

  it("reports approximate tokens and part count", () => {
    const packet = buildSubmissionPacket(
      [part({ type: "text", text: "abcd" }), part({ type: "link", url: "https://x" })],
      "summary",
    );
    expect(packet.partCount).toBe(2);
    expect(packet.approxTokens).toBe(Math.ceil(packet.asPromptText.length / 4));
  });
});
