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
    expect(a).toContain("Project-centric focus");
    expect(a).toContain("Week X rule");
    expect(a).toContain("Roman English");
    expect(a).toContain("[Coherence Check]");
    expect(b).toContain("classroom");
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
