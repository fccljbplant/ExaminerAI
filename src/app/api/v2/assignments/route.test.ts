import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isSubmissionsEnabled: vi.fn(),
  listLearnerAssignments: vi.fn(),
  listLearnerAssignmentCounts: vi.fn(),
  apiSuccess: vi.fn((data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 })),
  apiUnauthorized: vi.fn(() => new Response(null, { status: 401 })),
  apiError: vi.fn(
    (message: string, code: string, status: number) =>
      new Response(JSON.stringify({ ok: false, message, code }), { status }),
  ),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/api-response", () => ({
  apiSuccess: mocks.apiSuccess,
  apiUnauthorized: mocks.apiUnauthorized,
  apiError: mocks.apiError,
}));
vi.mock("@/modules/submission/lib/submission-flag", () => ({
  isSubmissionsEnabled: mocks.isSubmissionsEnabled,
}));
vi.mock("@/modules/submission/lib/submission-db", () => ({
  listLearnerAssignments: mocks.listLearnerAssignments,
  listLearnerAssignmentCounts: mocks.listLearnerAssignmentCounts,
}));

import { GET } from "./route";

function request(url = "http://localhost/api/v2/assignments") {
  return new NextRequest(url);
}

describe("GET /api/v2/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isSubmissionsEnabled.mockResolvedValue(true);
    mocks.listLearnerAssignments.mockResolvedValue({ items: [], nextCursor: null });
    mocks.listLearnerAssignmentCounts.mockResolvedValue({
      all: 0,
      due: 0,
      in_review: 0,
      returned: 0,
      graded: 0,
    });
  });

  it("rejects anonymous callers", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(mocks.apiUnauthorized).toHaveBeenCalled();
  });

  it("rejects non-learner roles", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(mocks.apiError).toHaveBeenCalledWith("Learner access only", "FORBIDDEN", 403);
  });

  it("rejects when the submissions flag is off", async () => {
    mocks.isSubmissionsEnabled.mockResolvedValue(false);
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(mocks.apiError).toHaveBeenCalledWith("Assignments are not enabled yet", "FORBIDDEN", 403);
  });

  it("serves the page plus per-filter counts in one payload", async () => {
    mocks.listLearnerAssignments.mockResolvedValue({
      items: [{ id: "a-1", title: "Bridge report" }],
      nextCursor: "a-1",
    });
    mocks.listLearnerAssignmentCounts.mockResolvedValue({
      all: 6,
      due: 2,
      in_review: 1,
      returned: 1,
      graded: 2,
    });

    const res = await GET(request("http://localhost/api/v2/assignments?status=due&courseId=course-9"));
    expect(res.status).toBe(200);

    expect(mocks.listLearnerAssignments).toHaveBeenCalledWith("learner-1", {
      status: "due",
      courseId: "course-9",
      cursor: undefined,
      limit: undefined,
    });
    expect(mocks.listLearnerAssignmentCounts).toHaveBeenCalledWith("learner-1", { courseId: "course-9" });
    expect(mocks.apiSuccess).toHaveBeenCalledWith({
      items: [{ id: "a-1", title: "Bridge report" }],
      nextCursor: "a-1",
      counts: { all: 6, due: 2, in_review: 1, returned: 1, graded: 2 },
    });
  });

  it("rejects invalid query parameters", async () => {
    const res = await GET(request("http://localhost/api/v2/assignments?status=nonsense"));
    expect(res.status).toBe(400);
    expect(mocks.apiError).toHaveBeenCalledWith(
      "Invalid query parameters",
      "VALIDATION_ERROR",
      400,
      expect.anything(),
    );
  });
});
