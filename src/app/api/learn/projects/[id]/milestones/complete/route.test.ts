import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  milestoneUpdate: vi.fn(),
  awardTypedXP: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: {
      findUnique: mocks.projectFindUnique,
      update: mocks.projectUpdate,
    },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    projectMilestone: { update: mocks.milestoneUpdate },
  },
}));
vi.mock("@/modules/learn/lib/xp-ledger", () => ({ awardTypedXP: mocks.awardTypedXP }));

import { POST } from "./route";

const project = {
  id: "project-1",
  userId: "learner-1",
  courseId: "course-1",
  status: "approved",
  milestones: [{ id: "milestone-1", order: 0, title: "Plan", status: "in_progress" }],
};

function request() {
  return new Request("http://localhost/api/learn/projects/project-1/milestones/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ milestoneId: "milestone-1" }),
  });
}

function invoke() {
  return POST(request(), { params: Promise.resolve({ id: "project-1" }) });
}

describe("POST /api/learn/projects/[id]/milestones/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.projectFindUnique.mockResolvedValue(project);
    mocks.projectUpdate.mockResolvedValue({ id: "project-1", status: "completed" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.milestoneUpdate.mockResolvedValue({ ...project.milestones[0], status: "completed" });
    mocks.awardTypedXP.mockResolvedValue({ awarded: true });
  });

  it("denies non-learner roles before reading a project", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(mocks.projectFindUnique).not.toHaveBeenCalled();
  });

  it("denies a project owned by another learner", async () => {
    mocks.projectFindUnique.mockResolvedValue({ ...project, userId: "learner-2" });
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
  });

  it("denies legacy projects that are not linked to a course", async () => {
    mocks.projectFindUnique.mockResolvedValue({ ...project, courseId: null });
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.milestoneUpdate).not.toHaveBeenCalled();
  });

  it("denies milestone completion after course enrollment is lost", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.milestoneUpdate).not.toHaveBeenCalled();
    expect(mocks.awardTypedXP).not.toHaveBeenCalled();
  });

  it("does not complete milestones for an unapproved proposal", async () => {
    mocks.projectFindUnique.mockResolvedValue({ ...project, status: "pending_approval" });
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(mocks.milestoneUpdate).not.toHaveBeenCalled();
  });

  it("awards XP only after an enrolled owner completes a milestone", async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(mocks.milestoneUpdate).toHaveBeenCalledWith({
      where: { id: "milestone-1" },
      data: { status: "completed", completedAt: expect.any(Date) },
    });
    expect(mocks.awardTypedXP).toHaveBeenCalledWith(
      "learner-1",
      "project_step",
      "course-1",
      "milestone:milestone-1",
    );
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "completed" },
    });
  });
});
