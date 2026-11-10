import { db } from "@/lib/db";

export interface CourseReportCardFields {
  userId: string;
  courseId: string;
  week: number;
  grade: string | null;
  score: number | null;
  strengths: string;
  weaknesses: string;
  progress: string;
  nextSteps: string;
}

export class ReportCardWriteError extends Error {
  constructor(
    public readonly code: "REPORT_CARD_REASON_REQUIRED" | "REPORT_CARD_VERSION_CONFLICT",
  ) {
    super(code);
    this.name = "ReportCardWriteError";
  }
}

/**
 * Persist a course-scoped report card and an immutable snapshot for every
 * version. Updates never overwrite history; manual corrections can require
 * an optimistic expectedVersion to prevent stale edits.
 */
export async function saveCourseReportCard(input: {
  fields: CourseReportCardFields;
  actorId: string;
  actorRole: string;
  reason?: string;
  expectedVersion?: number;
  requireExpectedVersion?: boolean;
}) {
  const reason = input.reason?.trim() ?? "";

  return db.$transaction(async (tx) => {
    const existing = await tx.reportCard.findUnique({
      where: {
        userId_courseId_week: {
          userId: input.fields.userId,
          courseId: input.fields.courseId,
          week: input.fields.week,
        },
      },
    });

    if (existing) {
      if (input.requireExpectedVersion && input.expectedVersion !== existing.version) {
        throw new ReportCardWriteError("REPORT_CARD_VERSION_CONFLICT");
      }
      if (!reason) {
        throw new ReportCardWriteError("REPORT_CARD_REASON_REQUIRED");
      }

      // Compare-and-swap the version in the write itself. The initial read
      // and expectedVersion check cannot prevent a concurrent update race.
      const updateResult = await tx.reportCard.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          ...input.fields,
          date: new Date(),
          version: existing.version + 1,
          updatedById: input.actorId,
          updatedByRole: input.actorRole,
        },
      });
      if (updateResult.count !== 1) {
        throw new ReportCardWriteError("REPORT_CARD_VERSION_CONFLICT");
      }

      const updated = await tx.reportCard.findUnique({
        where: { id: existing.id },
      });
      if (!updated) {
        throw new ReportCardWriteError("REPORT_CARD_VERSION_CONFLICT");
      }
      await tx.reportCardVersion.create({
        data: {
          reportCardId: updated.id,
          version: updated.version,
          userId: updated.userId,
          courseId: updated.courseId,
          week: updated.week,
          date: updated.date,
          grade: updated.grade,
          score: updated.score,
          strengths: updated.strengths,
          weaknesses: updated.weaknesses,
          progress: updated.progress,
          nextSteps: updated.nextSteps,
          actorId: input.actorId,
          actorRole: input.actorRole,
          reason,
        },
      });
      return tx.reportCard.findUnique({
        where: { id: updated.id },
        include: { versions: { orderBy: { version: "asc" } } },
      });
    }

    const created = await tx.reportCard.create({
      data: {
        ...input.fields,
        date: new Date(),
        version: 1,
        updatedById: input.actorId,
        updatedByRole: input.actorRole,
      },
    });
    await tx.reportCardVersion.create({
      data: {
        reportCardId: created.id,
        version: created.version,
        userId: created.userId,
        courseId: created.courseId,
        week: created.week,
        date: created.date,
        grade: created.grade,
        score: created.score,
        strengths: created.strengths,
        weaknesses: created.weaknesses,
        progress: created.progress,
        nextSteps: created.nextSteps,
        actorId: input.actorId,
        actorRole: input.actorRole,
        reason: reason || "Initial course report card creation",
      },
    });
    return tx.reportCard.findUnique({
      where: { id: created.id },
      include: { versions: { orderBy: { version: "asc" } } },
    });
  });
}
