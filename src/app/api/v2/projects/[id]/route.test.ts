import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  demoWriteBlock: vi.fn(),
  projectFindFirst: vi.fn(),
  projectUpdate: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  taskFindMany: vi.fn(),
  weekFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  courseFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: { findFirst: mocks.projectFindFirst, update: mocks.projectUpdate },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    projectTask: { findMany: mocks.taskFindMany },
    projectWeek: { findMany: mocks.weekFindMany },
    user: { findUnique: mocks.userFindUnique },
    course: { findUnique: mocks.courseFindUnique },
  },
}));

import { GET, PATCH } from "./route";

const project = {
  id: "project-1",
  userId: "learner-1",
  courseId: "course-1",
  status: "pending_approval",
  title: "Build a bridge",
  goal: "Learn structural design",
  stack: null,
  currentState: null,
  deadline: null,
  createdAt: new Date("2026-11-15T00:00:00.000Z"),
  approvedById: null,
  milestones: [],
};

function getRequest() {
  return new NextRequest("http://localhost/api/v2/projects/project-1");
}

function patchRequest(body: unknown = { title: "Updated title" }) {
  return new NextRequest("http://localhost/api/v2/projects/project-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: "project-1" }) };
}

describe("/api/v2/projects/[id] course access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(project);
    mocks.projectUpdate.mockResolvedValue({
      id: project.id,
      status: project.status,
      title: "Updated title",
      description: null,
      objectives: null,
      durationWeeks: 4,
    });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.weekFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.courseFindUnique.mockResolvedValue({ name: "Structural Engineering" });
  });

  it("hides course-less legacy projects from GET without guessing their course", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, courseId: null });

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
    expect(mocks.weekFindMany).not.toHaveBeenCalled();
  });

  it("denies GET after the learner loses course enrollment", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
    expect(mocks.weekFindMany).not.toHaveBeenCalled();
  });

  it("loads only project- and course-scoped tasks and weeks for enrolled learners", async () => {
    const response = await GET(getRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.project.courseName).toBe("Structural Engineering");
    expect(mocks.taskFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.taskFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: "project-1", courseId: "course-1" },
    }));
    expect(mocks.weekFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.weekFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: "project-1", courseId: "course-1" },
    }));
  });

  it("hides course-less legacy projects from PATCH without mutating them", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, courseId: null });

    const response = await PATCH(patchRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it("denies PATCH after enrollment is revoked and does not mutate the project", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await PATCH(patchRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it("allows PATCH for the project owner while actively enrolled", async () => {
    const response = await PATCH(patchRequest(), context());

    expect(response.status).toBe(200);
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "project-1" },
      data: { title: "Updated title" },
    }));
  });
});
