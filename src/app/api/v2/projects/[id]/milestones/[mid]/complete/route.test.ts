import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  demoWriteBlock: vi.fn(),
  projectFindFirst: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  milestoneFindFirst: vi.fn(),
  milestoneUpdate: vi.fn(),
  milestoneCount: vi.fn(),
  projectUpdate: vi.fn(),
  awardTypedXP: vi.fn(),
  engagementEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    learnProject: { findFirst: mocks.projectFindFirst, update: mocks.projectUpdate },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    projectMilestone: {
      findFirst: mocks.milestoneFindFirst,
      update: mocks.milestoneUpdate,
      count: mocks.milestoneCount,
    },
    engagementEvent: { create: mocks.engagementEventCreate },
  },
}));
vi.mock("@/modules/learn", () => ({ awardTypedXP: mocks.awardTypedXP }));

import { POST } from "./route";

const project = { id: "project-1", courseId: "course-1", status: "approved" };
const milestone = { id: "milestone-1", projectId: "project-1", status: "planned" };

function postRequest() {
  return new NextRequest("http://localhost/api/v2/projects/project-1/milestones/milestone-1/complete", {
    method: "POST",
  });
}

function context() {
  return { params: Promise.resolve({ id: "project-1", mid: "milestone-1" }) };
}

describe("/api/v2/projects/[id]/milestones/[mid]/complete course access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(project);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.milestoneFindFirst.mockResolvedValue(milestone);
    mocks.milestoneUpdate.mockResolvedValue({ ...milestone, status: "completed" });
    mocks.milestoneCount.mockResolvedValue(1);
    mocks.projectUpdate.mockResolvedValue({ ...project });
    mocks.awardTypedXP.mockResolvedValue(undefined);
    mocks.engagementEventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("rejects course-less legacy projects before touching milestones", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, courseId: null });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.milestoneFindFirst).not.toHaveBeenCalled();
    expect(mocks.milestoneUpdate).not.toHaveBeenCalled();
  });

  it("rejects completion after course enrollment is revoked", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(404);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-1", role: "student" },
      select: { id: true },
    });
    expect(mocks.milestoneFindFirst).not.toHaveBeenCalled();
    expect(mocks.milestoneUpdate).not.toHaveBeenCalled();
    expect(mocks.awardTypedXP).not.toHaveBeenCalled();
  });

  it("keeps the approval gate ahead of milestone completion", async () => {
    mocks.projectFindFirst.mockResolvedValue({ ...project, status: "pending_approval" });

    const response = await POST(postRequest(), context());

    expect(response.status).toBe(403);
    expect(mocks.milestoneFindFirst).not.toHaveBeenCalled();
  });

  it("completes a milestone with course-scoped XP and engagement event", async () => {
    const response = await POST(postRequest(), context());

    expect(response.status).toBe(200);
    expect(mocks.milestoneUpdate).toHaveBeenCalledWith({
      where: { id: "milestone-1" },
      data: expect.objectContaining({ status: "completed" }),
    });
    expect(mocks.awardTypedXP).toHaveBeenCalledWith("learner-1", "project_step", "course-1", "milestone:milestone-1");
    expect(mocks.engagementEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "learner-1", courseId: "course-1", eventType: "milestone.completed" }),
    });
  });
});
