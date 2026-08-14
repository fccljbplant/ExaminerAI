/**
 * POST /api/v2/diagnostic/start — L12 diagnostic quiz start (REDESIGN-P4, W3)
 *
 * Creates a 10-question diagnostic session for learners returning from
 * a long absence (scenario S6). Questions are drawn from the learner's
 * weakest DrillCard topics.
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
import { DiagnosticStartSchema } from "@/modules/learn/contracts";
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

  const parsed = DiagnosticStartSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { courseId } = parsed.data;

  try {
    // Draw 10 questions from the learner's DrillCard history (weakest first).
    const cards = await db.drillCard.findMany({
      where: { userId: user.sub },
      orderBy: [{ lastScore: "asc" }, { attempts: "desc" }],
      take: 10,
      select: { id: true, topic: true, questionDigest: true, explanation: true },
    });

    // If not enough DrillCards, pull from DailyTestAnswer as fallback.
    if (cards.length < 10) {
      const fallback = await db.dailyTestAnswer.findMany({
        where: {
          dailyTest: {
            OR: [{ userId: user.sub }],
          },
        },
        select: { question: true, topic: true },
        take: 10 - cards.length,
      });
      // Merge fallback topics.
      for (const f of fallback) {
        cards.push({
          id: `fallback-${Math.random().toString(36).slice(2, 8)}`,
          topic: f.topic ?? "General",
          questionDigest: f.question,
          explanation: "",
        });
      }
    }

    // Create a diagnostic session via EngagementEvent.
    const sessionId = `diag-${Date.now()}-${user.sub.slice(0, 8)}`;
    await db.engagementEvent.create({
      data: {
        userId: user.sub,
        courseId,
        eventType: "diagnostic.start",
        metadata: { sessionId, questionCount: cards.length } as unknown as Prisma.InputJsonValue,
      },
    });

    return apiSuccess({
      sessionId,
      questions: cards.map((c, i) => ({
        index: i,
        topic: c.topic,
        question: c.questionDigest,
      })),
      totalQuestions: cards.length,
    });
  } catch (err) {
    return apiServerError(err instanceof Error ? err.message : "Diagnostic start failed");
  }
}
