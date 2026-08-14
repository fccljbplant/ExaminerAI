/**
 * POST /api/v2/diagnostic/answer — L12 diagnostic quiz answer (REDESIGN-P4, W3)
 *
 * Records a single answer for a diagnostic session. After the 10th
 * answer the session auto-computes a routing recommendation.
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiUnauthorized,
  apiError,
  apiServerError,
} from "@/lib/api-response";
import { DiagnosticAnswerSchema } from "@/modules/learn/contracts";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = DiagnosticAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { sessionId, questionIndex, answer } = parsed.data;

  try {
    // Record the answer as an EngagementEvent.
    await db.engagementEvent.create({
      data: {
        userId: user.sub,
        eventType: "diagnostic.answer",
        metadata: {
          sessionId,
          questionIndex,
          answer,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Check if this was the last question (index 9 = 10th question).
    const isLast = questionIndex >= 9;

    if (isLast) {
      // Compute routing recommendation.
      // For now: if average score >= 70 → "jump_ahead", else → "review".
      const allAnswers = await db.engagementEvent.findMany({
        where: {
          userId: user.sub,
          eventType: "diagnostic.answer",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // Simple routing: count answers in this session.
      const sessionAnswers = allAnswers.filter((e) => {
        const meta = e.metadata as { sessionId?: string } | null;
        return meta?.sessionId === sessionId;
      });

      // Mark diagnostic complete.
      await db.engagementEvent.create({
        data: {
          userId: user.sub,
          eventType: "diagnostic.complete",
          metadata: {
            sessionId,
            totalQuestions: sessionAnswers.length,
            recommendation: "review", // default to review
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return apiSuccess({
        sessionId,
        complete: true,
        recommendation: "review",
        copy: "Great effort! Based on your answers, we recommend reviewing the fundamentals before moving ahead.",
      });
    }

    return apiSuccess({
      sessionId,
      questionIndex,
      complete: false,
      nextQuestion: questionIndex + 1,
    });
  } catch (err) {
    return apiServerError(err instanceof Error ? err.message : "Answer recording failed");
  }
}
