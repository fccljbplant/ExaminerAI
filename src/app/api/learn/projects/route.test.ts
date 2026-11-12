import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  demoWriteBlock: vi.fn(),
  learnProjectFindMany: vi.fn(),
  learnProjectFindFirst: vi.fn(),
  learnProjectCreate: vi.fn(),
  enrollmentFindMany: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  notificationCreateMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: {
      findMany: mocks.learnProjectFindMany,
      findFirst: mocks.learnProjectFindFirst,
      create: mocks.learnProjectCreate,
    },
    courseEnrollment: {
      findMany: mocks.enrollmentFindMany,
      findFirst: mocks.enrollmentFindFirst,
    },
    notification: { createMany: mocks.notificationCreateMany },
  },
}));

import { GET, POST } from "./route";

const enrollments = [
  { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
  { courseId: "course-2", course: { id: "course-2", name: "Course Two" } },
];

describe("/api/learn/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({
      sub: "learner-1",
      role: "learner",
      email: "learner@example.test",
      name: "Learner",
    });
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.enrollmentFindMany.mockResolvedValue(enrollments);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.learnProjectFindMany.mockResolvedValue([]);
    mocks.learnProjectFindFirst.mockResolvedValue(null);
    mocks.learnProjectCreate.mockResolvedValue({
      id: "project-1",
      title: "Project One",
      milestones: [],
    });
    mocks.notificationCreateMany.mockResolvedValue({ count: 0 });
  });

  it("denies unauthenticated list requests", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/learn/projects"));
    expect(response.status).toBe(401);
    expect(mocks.learnProjectFindMany).not.toHaveBeenCalled();
  });

  it("denies non-learner list requests", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "staff-1", role: "instructor" });
    const response = await GET(new Request("http://localhost/api/learn/projects"));
    expect(response.status).toBe(403);
    expect(mocks.learnProjectFindMany).not.toHaveBeenCalled();
  });

  it("lists only course-linked projects in current student enrolments plus personal course-less projects", async () => {
    await GET(new Request("http://localhost/api/learn/projects"));
    expect(mocks.learnProjectFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "learner-1",
        OR: [
          { courseId: { in: ["course-1", "course-2"] } },
          { courseId: null },
        ],
      },
    }));
  });

  it("rejects a requested course outside the learner's current enrolments", async () => {
    const response = await GET(new Request("http://localhost/api/learn/projects?courseId=course-foreign"));
    expect(response.status).toBe(403);
    expect(mocks.learnProjectFindMany).not.toHaveBeenCalled();
  });

  it("scopes a requested course to the learner's own active enrolment", async () => {
    await GET(new Request("http://localhost/api/learn/projects?courseId=course-1"));
    expect(mocks.learnProjectFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: "course-1" },
    }));
  });

  it("denies project creation to non-learner roles", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "staff-1", role: "instructor" });
    const response = await POST(new Request("http://localhost/api/learn/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: "course-1", title: "Project" }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.learnProjectCreate).not.toHaveBeenCalled();
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
  });

  it("rejects project creation when the learner is not enrolled in the requested course", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/learn/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: "course-foreign", title: "Project" }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.learnProjectFindFirst).not.toHaveBeenCalled();
    expect(mocks.learnProjectCreate).not.toHaveBeenCalled();
  });

  it("creates a project only after confirming the learner's student enrolment", async () => {
    await POST(new Request("http://localhost/api/learn/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: " course-1 ", title: "Project" }),
    }));
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.learnProjectCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "learner-1", courseId: "course-1" }),
    }));
  });
});
