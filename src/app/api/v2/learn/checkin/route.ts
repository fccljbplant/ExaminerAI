/**
 * POST /api/v2/learn/checkin — learner daily check-in (V1 CheckInPanel
 * re-homed, W10 audit: don't kill features)
 *
 * One check-in per learner per day (upsert). Feeds the instructor's
 * engagement view + attention signals. Phase-1 compliant: confidence +
 * what-did-you-do + reflection — no psych scoring.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student", "demo"]);

const CheckinSchema = z.object({
  courseId: z.string().min(1),
  whatDidYouDo: z.string().min(1).max(2_000),
  confidence: z.number().int().min(1).max(5),
  anyErrors: z.string().max(2_000).optional(),
  learningReflection: z.string().max(2_000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("checking in");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid check-in", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId: parsed.data.courseId } },
    select: { masteryMap: true },
  });
  const mastery = (profile?.masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } } | null) ?? {};
  const week = mastery.topicProgress?.current?.week ?? 1;
  const day = mastery.topicProgress?.current?.day ?? 1;

  // One check-in per (user, course, day) — checking in on another course
  // the same day must never overwrite this course's row (2026-08-18 audit).
  const existing = await db.dailyLog.findFirst({
    where: { userId: user.sub, courseId: parsed.data.courseId, date: { gte: start, lt: end } },
  });

  const log = existing
    ? await db.dailyLog.update({
        where: { id: existing.id },
        data: {
          whatDidYouDo: parsed.data.whatDidYouDo,
          confidence: parsed.data.confidence,
          anyErrors: parsed.data.anyErrors ?? "",
          learningReflection: parsed.data.learningReflection ?? "",
          week,
          day,
          courseId: parsed.data.courseId,
        },
      })
    : await db.dailyLog.create({
        data: {
          userId: user.sub,
          courseId: parsed.data.courseId,
          date: new Date(),
          week,
          day,
          whatDidYouDo: parsed.data.whatDidYouDo,
          confidence: parsed.data.confidence,
          anyErrors: parsed.data.anyErrors ?? "",
          learningReflection: parsed.data.learningReflection ?? "",
        },
      });

  await db.engagementEvent.create({
    data: {
      userId: user.sub,
      courseId: parsed.data.courseId,
      eventType: "checkin.done",
      metadata: { confidence: parsed.data.confidence },
    },
  });

  return apiSuccess({ id: log.id, date: log.date.toISOString() });
}
