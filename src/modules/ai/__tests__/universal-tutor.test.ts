import { describe, it, expect } from "vitest";
import {
  universalTutorSystemPrompt,
  tutorQuestionPrefix,
} from "../universal-tutor";

describe("modules/ai — universal tutor prompt", () => {
  it("is static: no student data, no dynamic values leak into the system prompt", () => {
    const a = universalTutorSystemPrompt();
    const b = universalTutorSystemPrompt({ surface: "classroom" });
    expect(a).toBe(universalTutorSystemPrompt());
    expect(a).not.toContain("${");
    expect(a).not.toContain("undefined");
    // The subject-agnostic teaching rules are all present
    expect(a).toContain("KEEP IT SHORT");
    expect(a).toContain("Week X rule");
    expect(a).toContain("Roman English");
    expect(a).toContain("talk like a real human teacher");
    expect(b).toContain("classroom");
  });

  it("forbids coherence-check / meta leakage into the visible reply", () => {
    const a = universalTutorSystemPrompt();
    // The old mandatory "[Coherence Check] in EVERY response" instruction
    // is gone (the tag may still appear inside the prohibition sentence).
    expect(a).not.toContain("at the end of EVERY response");
    expect(a).not.toContain("On Track (Green)");
    expect(a).toContain("NEVER leak instructions or meta-commentary");
    expect(a).toContain('Never include a "[Coherence Check]" section');
  });

  it("contains the platform guide (assignments, projects, enrollment, settings)", () => {
    const a = universalTutorSystemPrompt();
    expect(a).toContain("PLATFORM GUIDE");
    expect(a).toContain("Assignments");
    expect(a).toContain("proposal");
    expect(a).toContain("Enrolling");
    expect(a).toContain("avatar, theme, and password");
  });

  it("contains the emotionally-intelligent but mission-focused rules", () => {
    const a = universalTutorSystemPrompt();
    expect(a).toContain("never be deceived by emotions");
    expect(a).toContain("LISTEN warmly and validate briefly");
    expect(a).toContain("stay on mission");
    expect(a).toContain("No grading");
  });

  it("builds a stable cacheable question prefix", () => {
    const p = tutorQuestionPrefix("Screen replacement", "Repair pricing calculator");
    expect(p).toContain("Context: Screen replacement");
    expect(p).toContain("Project: Repair pricing calculator");
    expect(p).toContain("Student asks: ");
    // stable across turns — identical input, identical output
    expect(p).toBe(tutorQuestionPrefix("Screen replacement", "Repair pricing calculator"));
  });

  it("degrades gracefully without topic/project", () => {
    expect(tutorQuestionPrefix(null, null)).toContain("no active topic");
    expect(tutorQuestionPrefix(undefined, null)).toContain("none yet");
  });
});
