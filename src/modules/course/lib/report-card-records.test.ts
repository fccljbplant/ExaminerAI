import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  versionCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

import { ReportCardWriteError, saveCourseReportCard } from "./report-card-records";

const fields = {
  userId: "learner-1",
  courseId: "course-a",
  week: 2,
  grade: "B",
  score: 84,
  strengths: "[]",
  weaknesses: "[]",
  progress: "Course A evidence",
  nextSteps: "[]",
};

describe("saveCourseReportCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      reportCard: {
        findUnique: mocks.findUnique,
        create: mocks.create,
        update: mocks.update,
      },
      reportCardVersion: { create: mocks.versionCreate },
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    mocks.versionCreate.mockResolvedValue({});
  });

  it("creates the initial report card and immutable version one", async () => {
    const created = { id: "card-1", ...fields, version: 1, date: new Date() };
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...created, versions: [{ version: 1 }] });
    mocks.create.mockResolvedValue(created);

    const result = await saveCourseReportCard({
      fields,
      actorId: "instructor-1",
      actorRole: "instructor",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...fields, version: 1, updatedById: "instructor-1" }),
    });
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportCardId: "card-1",
        version: 1,
        actorId: "instructor-1",
        actorRole: "instructor",
        reason: "Initial course report card creation",
      }),
    });
    expect(result).toHaveProperty("versions");
  });

  it("records a new version rather than overwriting history", async () => {
    const existing = { id: "card-1", ...fields, version: 1, date: new Date("2026-01-01T00:00:00.000Z") };
    const updated = { ...existing, score: 90, grade: "A", version: 2, date: new Date() };
    mocks.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...updated, versions: [{ version: 1 }, { version: 2 }] });
    mocks.update.mockResolvedValue(updated);

    await saveCourseReportCard({
      fields: { ...fields, score: 90, grade: "A" },
      actorId: "instructor-1",
      actorRole: "instructor",
      reason: "Corrected after rubric review",
      expectedVersion: 1,
      requireExpectedVersion: true,
    });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: expect.objectContaining({ score: 90, grade: "A", version: 2 }),
    });
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportCardId: "card-1",
        version: 2,
        actorId: "instructor-1",
        reason: "Corrected after rubric review",
      }),
    });
  });

  it("rejects stale manual corrections", async () => {
    mocks.findUnique.mockResolvedValue({ id: "card-1", version: 3 });
    await expect(saveCourseReportCard({
      fields,
      actorId: "instructor-1",
      actorRole: "instructor",
      reason: "Correction",
      expectedVersion: 2,
      requireExpectedVersion: true,
    })).rejects.toMatchObject({ code: "REPORT_CARD_VERSION_CONFLICT" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires a reason when an existing report card is revised", async () => {
    mocks.findUnique.mockResolvedValue({ id: "card-1", version: 1 });
    await expect(saveCourseReportCard({
      fields,
      actorId: "instructor-1",
      actorRole: "instructor",
    })).rejects.toBeInstanceOf(ReportCardWriteError);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
