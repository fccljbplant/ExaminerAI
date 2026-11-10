import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  demoWriteBlock: vi.fn(),
  authorisedCourses: vi.fn(),
  userFindUnique: vi.fn(),
  courseFindUnique: vi.fn(),
  saveCourseReportCard: vi.fn(),
  logAudit: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/rbac", () => ({
  isStaffRole: (role: string) => role === "instructor" || role === "org_admin",
}));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    course: { findUnique: mocks.courseFindUnique },
  },
}));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.authorisedCourses,
}));
vi.mock("@/modules/course/lib/report-card-records", () => ({
  ReportCardWriteError: class ReportCardWriteError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
  saveCourseReportCard: mocks.saveCourseReportCard,
}));
vi.mock("@/modules/course/lib/report-card", () => ({
  parseCourseReportCardPolicy: () => ({
    gradingScale: [
      { grade: "A", min: 90, max: 100 },
      { grade: "B", min: 80, max: 89 },
      { grade: "C", min: 0, max: 79 },
    ],
    weights: { weeklyTest: 80, practice: 20 },
  }),
}));
vi.mock("@/lib/audit-log", () => ({
  AuditAction: { REPORT_CARD_UPDATED: "report_card_updated" },
  logAudit: mocks.logAudit,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError } }));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return POST(new NextRequest("http://localhost/api/report-cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

const validBody = {
  userId: "learner-1",
  courseId: "course-a",
  week: 1,
  score: 85,
  strengths: ["Clear reasoning"],
  weaknesses: ["Needs more practice"],
  nextSteps: ["Review the topic"],
  progress: "Evidence from Course A",
  reason: "Reviewed against course rubric",
  expectedVersion: 1,
};

describe("POST /api/report-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({
      sub: "instructor-1",
      name: "Instructor",
      role: "instructor",
    });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.authorisedCourses.mockResolvedValue(["course-a"]);
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1", role: "learner" });
    mocks.courseFindUnique.mockResolvedValue({
      id: "course-a",
      reportCardTemplateJson: "{}",
      weeks: [{ weekNumber: 1 }],
    });
    mocks.saveCourseReportCard.mockResolvedValue({
      id: "card-1",
      courseId: "course-a",
      week: 1,
      score: 85,
      grade: "B",
      version: 2,
    });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("rejects fractional scores before persistence", async () => {
    const response = await request({ ...validBody, score: 85.5 });
    expect(response.status).toBe(400);
    expect(mocks.saveCourseReportCard).not.toHaveBeenCalled();
  });

  it("rejects numeric strings instead of coercing API input", async () => {
    const response = await request({ ...validBody, score: "85" });
    expect(response.status).toBe(400);
    expect(mocks.saveCourseReportCard).not.toHaveBeenCalled();
  });

  it("persists an integer score with the selected course's derived grade", async () => {
    const response = await request(validBody);
    expect(response.status).toBe(200);
    expect(mocks.saveCourseReportCard).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({
        userId: "learner-1",
        courseId: "course-a",
        week: 1,
        score: 85,
        grade: "B",
      }),
      actorId: "instructor-1",
      requireExpectedVersion: true,
    }));
  });

  it("denies a course outside the staff member's authorised learner-course intersection", async () => {
    mocks.authorisedCourses.mockResolvedValue(["course-b"]);
    const response = await request(validBody);
    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.saveCourseReportCard).not.toHaveBeenCalled();
  });
});
