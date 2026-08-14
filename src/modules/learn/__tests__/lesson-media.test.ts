/**
 * Tests for src/modules/learn/lib/lesson-media.ts — the lesson media resolver.
 *
 * Covers:
 * - parseYouTubeId across all four common URL shapes (+ negatives)
 * - getLessonMedia resolver order: curated map → resources → slides-only
 */

import { describe, it, expect } from "vitest";
import { parseYouTubeId, getLessonMedia } from "@/modules/learn/lib/lesson-media";
import type { TopicContext } from "@/modules/learn/types";

const YT_ID = "wjZofJX0v4M"; // 11-char id used across fixtures

function makeTopic(overrides: Partial<TopicContext> = {}): TopicContext {
  return {
    week: 1,
    day: 1,
    title: "Test Topic",
    objective: "Learn the thing",
    resources: [],
    phase: "foundation",
    ...overrides,
  };
}

describe("parseYouTubeId", () => {
  it("parses watch?v= URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${YT_ID}`)).toBe(YT_ID);
  });

  it("parses watch URLs with extra params", () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?list=PL123&v=${YT_ID}&t=30s`)).toBe(YT_ID);
  });

  it("parses youtu.be short links", () => {
    expect(parseYouTubeId(`https://youtu.be/${YT_ID}`)).toBe(YT_ID);
  });

  it("parses embed URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${YT_ID}`)).toBe(YT_ID);
  });

  it("parses shorts URLs", () => {
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${YT_ID}`)).toBe(YT_ID);
  });

  it("returns null for non-YouTube URLs", () => {
    expect(parseYouTubeId("https://developer.mozilla.org/docs/Web")).toBeNull();
  });

  it("returns null for YouTube URLs without a valid id", () => {
    expect(parseYouTubeId("https://www.youtube.com/c/somechannel")).toBeNull();
  });
});

describe("getLessonMedia", () => {
  it("returns slides-only when the topic has no video resources", () => {
    const topic = makeTopic({
      resources: [{ label: "MDN docs", url: "https://developer.mozilla.org/docs/Web" }],
    });
    expect(getLessonMedia(topic)).toEqual({ kind: "slides" });
  });

  it("returns slides-only when resources are empty", () => {
    expect(getLessonMedia(makeTopic())).toEqual({ kind: "slides" });
  });

  it("uses the first YouTube resource found", () => {
    const topic = makeTopic({
      resources: [
        { label: "Docs", url: "https://developer.mozilla.org/docs/Web" },
        { label: "Intro video", url: `https://youtu.be/${YT_ID}` },
        { label: "Another video", url: "https://youtu.be/dQw4w9WgXcQ" },
      ],
    });
    const media = getLessonMedia(topic);
    expect(media.kind).toBe("video");
    expect(media.video).toEqual({ provider: "youtube", videoId: YT_ID, title: "Intro video" });
  });

  it("uses the resource label as the video title", () => {
    const topic = makeTopic({
      resources: [{ label: "Great explainer", url: `https://www.youtube.com/watch?v=${YT_ID}` }],
    });
    const media = getLessonMedia(topic);
    expect(media.video?.title).toBe("Great explainer");
  });
});
