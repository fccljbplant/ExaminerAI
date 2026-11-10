import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enrollmentFindMany: vi.fn(),
  courseFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findMany: mocks.enrollmentFindMany },
    course: { findUnique: mocks.courseFindUnique },
  },
}));

import { getCourseMetadata, getCourseTopics } from "./course-db";

describe("course database context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not select the first course when a learner has multiple enrolments", async () => {
    mocks.enrollmentFindMany.mockResolvedValue([
      { courseId: "course-a" },
      { courseId: "course-b" },
    ]);

    await expect(getCourseTopics("learner-1")).resolves.toEqual([]);
    await expect(getCourseMetadata("learner-1")).resolves.toBeNull();
    expect(mocks.courseFindUnique).not.toHaveBeenCalled();
    expect(mocks.enrollmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2,
    }));
  });

  it("does not replace a missing course outline with shared default topics", async () => {
    mocks.enrollmentFindMany.mockResolvedValue([]);
    await expect(getCourseTopics("learner-1")).resolves.toEqual([]);
    expect(mocks.courseFindUnique).not.toHaveBeenCalled();
  });

  it("loads the explicit course selected by the learner", async () => {
    mocks.enrollmentFindMany.mockResolvedValue([{ courseId: "course-b" }]);
    mocks.courseFindUnique.mockResolvedValue({
      weeks: [{
        weekNumber: 2,
        phase: "Course B",
        days: [{
          title: "Course B day",
          objective: "Apply the course method",
          resources: "[]",
          whyItMatters: "Course context",
          topicsCovered: "[]",
          activity: "Practice",
          deliverable: "Worked example",
          day: 1,
          videoUrl: null,
          videoTitle: null,
          codeExamples: "[]",
          webImages: "[]",
        }],
      }],
    });

    const topics = await getCourseTopics("learner-1", "course-b");
    expect(mocks.enrollmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", role: "student", courseId: "course-b" },
      take: 1,
    }));
    expect(topics).toHaveLength(1);
    expect(topics[0].week).toBe(2);
    expect(topics[0].topics[0].title).toBe("Course B day");
  });
});
