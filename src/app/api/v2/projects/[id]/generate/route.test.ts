import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  demoWriteBlock: vi.fn(),
  projectFindFirst: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  generateProjectTimeline: vi.fn(),
  engagementEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: { findFirst: mocks.projectFindFirst },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    engagementEvent: { create: mocks.engagementEventCreate },
  },
}));
vi.mock("@/modules/project/lib/project-timeline", () => ({
  generateProjectTimeline: mocks.generateProjectTimeline,
}));

import { POST } from "./route";

const project = {
  id: "project-1",
  userId: "learner-1",
  courseId: "course-1",
  status: "approved",
  title: "Build a bridge",
  goal: "Learn structural design",
  stack: null,
  currentState: null,
  description: null,
  objectives: null,
  durationWeeks: 4,
};

function postRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/v2/projects/project-1/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: "project-1" }) };
}

describe("/api/v2/projects/[id]/generate course access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(project);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.generateProjectTimeline.mockResolvedValue({
      ok: true,
      weeksCreated: 4,
      tasksCreated: 20,
      weeksRequested: 4,
    });
    mocks.engagementEventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("rejects course-less legacy projects before any generation", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, courseId: null });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.generateProjectTimeline).not.toHaveBeenCalled();
    expect(mocks.engagementEventCreate).not.toHaveBeenCalled();
  });

  it("rejects generation after course enrollment is revoked", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.generateProjectTimeline).not.toHaveBeenCalled();
    expect(mocks.engagementEventCreate).not.toHaveBeenCalled();
  });

  it("keeps the approval gate ahead of generation for enrolled learners", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, status: "pending_approval" });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.generateProjectTimeline).not.toHaveBeenCalled();
  });

  it("generates only for the owner while actively enrolled", async () => {
    const response = await POST(postRequest({ tasksPerWeek: 5 }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.generateProjectTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project-1", courseId: "course-1" }),
      { tasksPerWeek: 5 },
    );
    expect(mocks.engagementEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "learner-1", courseId: "course-1", eventType: "project.timeline_generated" }),
    });
    expect(body.data.tasksCreated).toBe(20);
  });
});
