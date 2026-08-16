import { describe, it, expect } from "vitest";
import {
  topicInOutline,
  nextTopicInOutline,
  prevTopicInOutline,
  isLastTopicInOutline,
  type OutlineWeek,
} from "../lib/course-outline";

/** 2-week course: week 1 has 3 days, week 2 has 1 day, week 3 is empty. */
function makeOutline(): OutlineWeek[] {
  const day = (day: number, title: string): OutlineWeek["days"][0] => ({
    day,
    title,
    objective: `${title} objective`,
    activity: null,
    deliverable: null,
  });
  return [
    { week: 1, phase: "Setup", days: [day(1, "A"), day(2, "B"), day(3, "C")] },
    { week: 2, phase: "Build", days: [day(1, "D")] },
    { week: 3, phase: "Empty", days: [] },
  ];
}

describe("course-outline progression helpers", () => {
  it("finds topics inside the outline", () => {
    const o = makeOutline();
    expect(topicInOutline(o, 1, 1)?.title).toBe("A");
    expect(topicInOutline(o, 2, 1)?.title).toBe("D");
  });

  it("returns null outside the course's own bounds (2-week course ends at 2-1)", () => {
    const o = makeOutline();
    expect(topicInOutline(o, 2, 2)).toBeNull();
    expect(topicInOutline(o, 3, 1)).toBeNull();
    expect(topicInOutline(o, 1, 4)).toBeNull();
  });

  it("advances within a week and across weeks", () => {
    const o = makeOutline();
    expect(nextTopicInOutline(o, 1, 1)).toEqual({ week: 1, day: 2 });
    expect(nextTopicInOutline(o, 1, 3)).toEqual({ week: 2, day: 1 });
  });

  it("skips empty weeks and ends at the last real topic", () => {
    const o = makeOutline();
    expect(nextTopicInOutline(o, 2, 1)).toBeNull();
    expect(isLastTopicInOutline(o, 2, 1)).toBe(true);
  });

  it("walks backwards within a week and across weeks", () => {
    const o = makeOutline();
    expect(prevTopicInOutline(o, 1, 2)).toEqual({ week: 1, day: 1 });
    expect(prevTopicInOutline(o, 2, 1)).toEqual({ week: 1, day: 3 });
    expect(prevTopicInOutline(o, 1, 1)).toBeNull();
  });
});
