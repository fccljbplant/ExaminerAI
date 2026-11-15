import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Classroom redesign guards (docs/UPGRADE-2026-11/CLASSROOM-AUDIT-2026-11-15.md).
 *
 * The 2026-11-15 deep audit found: a dead avatar bus (~35 no-op calls), two
 * duplicate topic maps (TopicPicker + JourneyPanel), duplicate chat CTAs,
 * five overlapping slide navigations, three copy-pasted drawer shells, and
 * a 1446-line monolith. These tests pin each fix so none of it regresses:
 *   1. one topic map (JourneyPanel) — TopicPicker stays deleted
 *   2. honest narration — every spoken line lands in the chat transcript;
 *      no no-op tutor.play() gestures anywhere in the classroom
 *   3. one drawer shell (PanelDrawer) for every panel
 *   4. the monolith stays split — the shell orchestrates, it does not render stages
 */

const ROOT = resolve(__dirname, "../../../..");
const classroom = (p: string) => join(ROOT, "src/modules/learn/components/classroom", p);
const read = (p: string) => readFileSync(classroom(p), "utf8");

const CLASSROOM_FILES = [
  "ClassroomShell.tsx", "ActivityRail.tsx", "QuickBar.tsx", "PostFlow.tsx",
  "TutorChat.tsx", "CoachMarks.tsx", "LessonStage.tsx", "VideoStage.tsx",
  "VoiceBar.tsx",
];

describe("classroom redesign — one topic map (audit A1)", () => {
  it("keeps TopicPicker deleted — JourneyPanel is the only topic map", () => {
    expect(existsSync(classroom("TopicPicker.tsx"))).toBe(false);
  });

  it("the shell offers exactly one entry point to the topic map: the rail", () => {
    const shell = read("ClassroomShell.tsx");
    expect(shell).toContain("ActivityRail");
    expect(shell).not.toContain("showTopics");
    expect(shell).not.toContain("ListTree");
  });

  it("the rail lists the four panels exactly once each", () => {
    const rail = read("ActivityRail.tsx");
    expect(rail.match(/key: "journey"/g)).toHaveLength(1);
    expect(rail.match(/key: "project"/g)).toHaveLength(1);
    expect(rail.match(/key: "grow"/g)).toHaveLength(1);
    expect(rail.match(/key: "library"/g)).toHaveLength(1);
  });
});

describe("classroom redesign — honest narration (audit A2)", () => {
  it("no no-op tutor.play() gestures anywhere in the classroom", () => {
    const offenders = CLASSROOM_FILES.filter((f) => read(f).includes("tutor.play("));
    expect(offenders, `no-op gestures in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("every spoken line lands in the chat transcript", () => {
    const shell = read("ClassroomShell.tsx");
    expect(shell).toContain("useTutorVoice");
    // the transcript setter appends a tutor message — visible narration
    expect(shell).toMatch(/role: "tutor", content: text/);
  });

  it("the panels no longer call the dead bus either", () => {
    for (const p of ["GrowPanel", "ProjectPanel", "JourneyPanel", "LibraryPanel"]) {
      const src = readFileSync(join(ROOT, `src/components/learn/panels/${p}.tsx`), "utf8");
      expect(src.includes("tutor.play("), `${p} still calls tutor.play`).toBe(false);
    }
  });
});

describe("classroom redesign — one drawer shell (audit A6)", () => {
  it("every panel opens through the shared PanelDrawer", () => {
    const shell = read("ClassroomShell.tsx");
    expect(shell.match(/<PanelDrawer/g)?.length).toBe(1);
    expect(shell).not.toMatch(/fixed inset-0 z-\[var\(--p-z-drawer\)\] flex/);
  });

  it("PanelDrawer closes on Escape and locks body scroll", () => {
    const drawer = readFileSync(join(ROOT, "src/modules/ui/panel-drawer.tsx"), "utf8");
    expect(drawer).toContain('e.key === "Escape"');
    expect(drawer).toContain("document.body.style.overflow");
  });
});

describe("classroom redesign — the monolith stays split (audit A5)", () => {
  it("the shell stays an orchestrator, not a stage renderer", () => {
    const shell = read("ClassroomShell.tsx");
    const lines = shell.split("\n").length;
    expect(lines).toBeLessThan(800);
    // orchestration, not implementation:
    expect(shell).not.toContain("CHECKIN_CONFIDENCE");
    expect(shell).not.toContain("function PostFlowStepper");
    expect(shell).not.toContain("function CoachMarks");
    expect(shell).not.toContain("function ActivityRailButton");
  });

  it("each extracted component still exists", () => {
    for (const f of ["ActivityRail.tsx", "QuickBar.tsx", "PostFlow.tsx", "TutorChat.tsx", "CoachMarks.tsx"]) {
      expect(existsSync(classroom(f)), `${f} missing`).toBe(true);
    }
  });
});

describe("classroom redesign — no duplicate chat entry points (audit A4)", () => {
  it("the Ask-AI control is mobile-only (the chat rail is always visible on md+)", () => {
    const quickbar = read("QuickBar.tsx");
    expect(quickbar).toContain("md:hidden");
    expect(quickbar.match(/aria-hidden \/> Ask AI/g)?.length).toBe(1);
    expect(quickbar).not.toContain("Notes");
  });
});

describe("classroom redesign — one token system (audit A7)", () => {
  it("no legacy token classes in any classroom file", () => {
    const legacy = /text-primary|bg-primary|bg-muted\b|text-muted-foreground|border-input|bg-background\b|border-border\b|focus:ring-2/;
    const offenders = CLASSROOM_FILES.filter((f) => legacy.test(read(f)));
    expect(offenders, `legacy tokens in: ${offenders.join(", ")}`).toEqual([]);
  });
});
