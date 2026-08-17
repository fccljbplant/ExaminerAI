/**
 * POST /api/v2/instructor/courses/[id]/quiz — generate a 5-question quiz
 * for one course module ("{week}-{day}") and persist it to the course
 * library as a LearnDailyTest row owned by the instructor.
 *
 * Body: { moduleId: "w-d" }
 *
 * On AI failure the route returns 503 (no fake data) — the caller can
 * retry. Instructor staff only.
 */

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { isStaffRole } from "@/lib/rbac";
import { isPortalEnabled } from "@/lib/feature-flags";
import { callAIJson } from "@/modules/assessment/lib/ai-json";

export const runtime = "nodejs";
export const maxDuration = 60;

const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        explanation: z.string(),
      }),
    )
    .min(1)
    .max(5),
});

/** Local midnight for today — the LearnDailyTest.date uniqueness anchor
 *  (mirrors the daily-test start route's date normalization). */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!isStaffRole(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { id: courseId } = await ctx.params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, ownerUserId: true },
  });
  if (!course) return apiNotFound("Course not found");

  // Instructors must teach the course (or own it); org/platform admins
  // manage their whole catalog.
  if (user.role === "instructor") {
    const teaches = await db.courseEnrollment.findFirst({
      where: { userId: user.sub, role: "instructor", courseId },
      select: { id: true },
    });
    if (!teaches && course.ownerUserId !== user.sub) {
      return apiError("You do not teach this course", "FORBIDDEN", 403);
    }
  }

  const body = (await req.json().catch(() => ({}))) as { moduleId?: string };
  const moduleId = (body.moduleId ?? "").trim();
  if (!/^\d+-\d+$/.test(moduleId)) {
    return apiValidationError({ moduleId: 'moduleId must be "{week}-{day}"' });
  }
  const [weekNumber, dayNumber] = moduleId.split("-").map(Number);

  const courseWeek = await db.courseWeek.findUnique({
    where: { courseId_weekNumber: { courseId, weekNumber } },
  });
  if (!courseWeek) return apiNotFound(`Week ${weekNumber} not found in this course`);
  const day = await db.courseDay.findUnique({
    where: { courseWeekId_day: { courseWeekId: courseWeek.id, day: dayNumber } },
  });
  if (!day) return apiNotFound(`Day ${dayNumber} not found in week ${weekNumber}`);

  let topics: string[] = [];
  try {
    const parsed: unknown = JSON.parse(day.topicsCovered);
    if (Array.isArray(parsed)) topics = parsed.filter((t): t is string => typeof t === "string");
  } catch {
    topics = [];
  }

  const systemPrompt = [
    "You are an instructor assistant on the TraineesAI Learn platform. Write a short module quiz.",
    "Generate EXACTLY 5 questions assessing the module material below.",
    "Mix multiple-choice style and short-answer style questions.",
    "Each item: { question, answer, explanation }.",
    " - question: one clear, self-contained question.",
    " - answer: the correct answer, one or two sentences.",
    " - explanation: 1-2 sentences on WHY the answer is correct.",
    "Keep every field in plain English and specific to THIS module's content.",
  ].join("\n");

  const userPrompt = [
    `Course module (Week ${weekNumber} Day ${dayNumber}):`,
    `Title: ${day.title}`,
    `Objective: ${day.objective}`,
    topics.length ? `Topics covered: ${topics.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callAIJson<z.infer<typeof QuizSchema>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: QuizSchema,
      feature: "module-quiz-gen",
      userId: user.sub,
      temperature: 0.5,
      maxTokens: 1200,
    },
  );

  if (!result.ok) {
    return apiError("AI unavailable", "AI_ERROR", 503);
  }

  // Persist to the course library: LearnDailyTest requires a userId, so
  // the row belongs to the instructor (the quiz is course content, not a
  // personal daily test). The (userId, courseId, date) unique key makes
  // regenerating the same day idempotent — it overwrites the library
  // quiz rather than stacking rows.
  const questions = result.data.questions.map((q) => ({
    ...q,
    moduleId,
    week: weekNumber,
    day: dayNumber,
  }));

  await db.learnDailyTest.upsert({
    where: {
      userId_courseId_date: { userId: user.sub, courseId, date: startOfToday() },
    },
    update: { questions: questions as unknown as Prisma.InputJsonValue },
    create: {
      userId: user.sub,
      courseId,
      date: startOfToday(),
      questions: questions as unknown as Prisma.InputJsonValue,
      status: "in_progress",
    },
  });

  return apiSuccess({ questions, count: questions.length });
}
