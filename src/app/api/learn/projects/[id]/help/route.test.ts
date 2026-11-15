import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  projectFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  helpSessionCreate: vi.fn(),
  helpSessionUpdate: vi.fn(),
  callAI: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: { findUnique: mocks.projectFindUnique },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    projectHelpSession: { create: mocks.helpSessionCreate, update: mocks.helpSessionUpdate },
  },
}));
vi.mock("@/modules/assessment/lib/ai-provider", () => ({ callAI: mocks.callAI }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const project = {
  id: "project-1",
  userId: "learner-1",
  courseId: "course-1",
  title: "Build a bridge",
  goal: "Learn structural design",
  stack: null,
  currentState: null,
  milestones: [],
  helpSessions: [],
};

function postRequest(blocker = "My truss analysis keeps failing") {
  return new Request("http://localhost/api/learn/projects/project-1/help", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocker }),
  });
}

function context() {
  return { params: Promise.resolve({ id: "project-1" }) };
}

describe("/api/learn/projects/[id]/help course access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.projectFindUnique.mockResolvedValue(project);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.helpSessionCreate.mockResolvedValue({
      id: "help-1", blocker: "My truss analysis keeps failing", hintLevel: 0, conversation: [],
    });
    mocks.helpSessionUpdate.mockResolvedValue({});
    mocks.callAI.mockResolvedValue({ text: "Check your load direction on the top chord." });
  });

  it("rejects non-learner roles before loading any project data", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.projectFindUnique).not.toHaveBeenCalled();
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("rejects a project owned by another user", async () => {
    mocks.projectFindUnique.mockResolvedValue({ ...project, userId: "someone-else" });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("rejects course-less legacy projects before any AI call", async () => {
    mocks.projectFindUnique.mockResolvedValue({ ...project, courseId: null });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(mocks.helpSessionCreate).not.toHaveBeenCalled();
  });

  it("rejects help after course enrollment is revoked", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(mocks.helpSessionCreate).not.toHaveBeenCalled();
  });

  it("serves the next hint ladder step for enrolled owners", async () => {
    const response = await POST(postRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hint).toBe("Check your load direction on the top chord.");
    expect(body.data.hintLevelName).toBe("nudge");
    expect(mocks.helpSessionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "help-1" },
      data: expect.objectContaining({ hintLevel: 1 }),
    }));
  });
});
