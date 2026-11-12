import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  demoWriteBlock: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  profileFindUnique: vi.fn(),
  dailyLogFindFirst: vi.fn(),
  dailyLogCreate: vi.fn(),
  dailyLogUpdate: vi.fn(),
  engagementEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    learnProfile: { findUnique: mocks.profileFindUnique },
    dailyLog: { findFirst: mocks.dailyLogFindFirst, create: mocks.dailyLogCreate, update: mocks.dailyLogUpdate },
    engagementEvent: { create: mocks.engagementEventCreate },
  },
}));

import { GET, POST } from "./route";

function getRequest(courseId = "course-a") {
  return new NextRequest(`http://localhost/api/v2/learn/checkin?courseId=${encodeURIComponent(courseId)}`);
}

function request(body: unknown) {
  return new Request("http://localhost/api/v2/learn/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

const validBody = {
  courseId: "course-a",
  whatDidYouDo: "Completed the lesson",
  confidence: 4,
};

describe("POST /api/v2/learn/checkin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.profileFindUnique.mockResolvedValue({ masteryMap: null });
    mocks.dailyLogFindFirst.mockResolvedValue(null);
    mocks.dailyLogCreate.mockResolvedValue({ id: "log-1", date: new Date("2026-11-12T08:00:00.000Z") });
    mocks.dailyLogUpdate.mockResolvedValue({ id: "log-1", date: new Date("2026-11-12T08:00:00.000Z") });
    mocks.engagementEventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("rejects a course the learner is not enrolled in before writing a log", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a", role: "student" },
      select: { id: true },
    });
    expect(mocks.dailyLogCreate).not.toHaveBeenCalled();
    expect(mocks.dailyLogUpdate).not.toHaveBeenCalled();
    expect(mocks.engagementEventCreate).not.toHaveBeenCalled();
  });

  it("writes a check-in only after confirming course enrollment", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledOnce();
    expect(mocks.dailyLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "learner-1",
        courseId: "course-a",
        whatDidYouDo: "Completed the lesson",
        confidence: 4,
      }),
    }));
    expect(mocks.engagementEventCreate).toHaveBeenCalledOnce();
  });
});


describe("GET /api/v2/learn/checkin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.dailyLogFindFirst.mockResolvedValue({
      id: "log-1",
      date: new Date("2026-11-12T08:00:00.000Z"),
      whatDidYouDo: "Completed the lesson",
      confidence: 4,
    });
  });

  it("returns only the authenticated learner's selected-course check-in for the current server day", async () => {
    const response = await GET(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: { checkin: { id: "log-1", whatDidYouDo: "Completed the lesson", confidence: 4 } },
    });
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a", role: "student" },
      select: { id: true },
    });
    expect(mocks.dailyLogFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "learner-1",
        courseId: "course-a",
        date: { gte: expect.any(Date), lt: expect.any(Date) },
      },
      select: { id: true, date: true, whatDidYouDo: true, confidence: true },
    });
    const query = mocks.dailyLogFindFirst.mock.calls[0][0].where.date;
    expect(query.lt.getTime() - query.gte.getTime()).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
    expect(query.lt.getTime() - query.gte.getTime()).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });

  it("returns an empty check-in when no row exists today", async () => {
    mocks.dailyLogFindFirst.mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(await response.json()).toMatchObject({ ok: true, data: { checkin: null } });
  });

  it("rejects missing course scope and unenrolled courses", async () => {
    const missingCourse = await GET(new NextRequest("http://localhost/api/v2/learn/checkin"));
    expect(missingCourse.status).toBe(400);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();

    mocks.enrollmentFindFirst.mockResolvedValue(null);
    const denied = await GET(getRequest("other-course"));
    expect(denied.status).toBe(403);
    expect(mocks.dailyLogFindFirst).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and non-learner callers", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await GET(getRequest())).status).toBe(401);

    mocks.getAuthUser.mockResolvedValue({ sub: "staff-1", role: "instructor" });
    expect((await GET(getRequest())).status).toBe(403);
    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
  });
});
