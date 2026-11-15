import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  demoWriteBlock: vi.fn(),
  projectFindFirst: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  taskCreate: vi.fn(),
  taskFindFirst: vi.fn(),
  taskUpdate: vi.fn(),
  taskDelete: vi.fn(),
  engagementEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: { findFirst: mocks.projectFindFirst },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    projectTask: {
      create: mocks.taskCreate,
      findFirst: mocks.taskFindFirst,
      update: mocks.taskUpdate,
      delete: mocks.taskDelete,
    },
    engagementEvent: { create: mocks.engagementEventCreate },
  },
}));

import { DELETE, PATCH, POST } from "./route";

const project = { id: "project-1", courseId: "course-1" };
const task = {
  id: "task-1",
  status: "planned",
  completedAt: null,
  description: "Review the design",
  week: 1,
  day: 2,
  isMilestone: false,
  taskNotes: null,
};

function context() {
  return { params: Promise.resolve({ id: "project-1" }) };
}

function postRequest() {
  return new NextRequest("http://localhost/api/v2/projects/project-1/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "Review the design", week: 1, day: 2 }),
  });
}

function patchRequest() {
  return new NextRequest("http://localhost/api/v2/projects/project-1/tasks", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: "task-1", status: "completed" }),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/v2/projects/project-1/tasks?taskId=task-1", {
    method: "DELETE",
  });
}

describe("/api/v2/projects/[id]/tasks course access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(project);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.taskCreate.mockResolvedValue(task);
    mocks.taskFindFirst.mockResolvedValue(task);
    mocks.taskUpdate.mockResolvedValue({ ...task, status: "completed", completedAt: new Date("2026-11-15T00:00:00.000Z") });
    mocks.taskDelete.mockResolvedValue(task);
    mocks.engagementEventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("rejects course-less legacy projects before creating a task", async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1", courseId: null });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("rejects task creation after course enrollment is revoked", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("creates tasks with the owning project and course IDs", async () => {
    const response = await POST(postRequest(), context());

    expect(response.status).toBe(200);
    expect(mocks.taskCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "learner-1", projectId: "project-1", courseId: "course-1" }),
    }));
  });

  it("denies task updates after enrollment is revoked", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await PATCH(patchRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.taskFindFirst).not.toHaveBeenCalled();
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });

  it("updates only a task in the same project and course and records completion", async () => {
    const response = await PATCH(patchRequest(), context());

    expect(response.status).toBe(200);
    expect(mocks.taskFindFirst).toHaveBeenCalledWith({
      where: { id: "task-1", projectId: "project-1", courseId: "course-1" },
    });
    expect(mocks.engagementEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "learner-1", courseId: "course-1", eventType: "project.task_completed" }),
    });
  });

  it("deletes only a task in the same project and course", async () => {
    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect(mocks.taskFindFirst).toHaveBeenCalledWith({
      where: { id: "task-1", projectId: "project-1", courseId: "course-1" },
    });
    expect(mocks.taskDelete).toHaveBeenCalledWith({ where: { id: "task-1" } });
  });
});
