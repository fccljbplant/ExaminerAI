/**
 * POST /api/v2/srs/[cardId]/review — L12 SRS card review (REDESIGN-P4, W3)
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiUnauthorized,
  apiError,
  apiNotFound,
  apiServerError,
} from "@/lib/api-response";
import { SrsReviewSchema } from "@/modules/learn/contracts";
import { reviewSrsCard } from "@/modules/learn/lib/study-flow-db";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const { cardId } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = SrsReviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const result = await reviewSrsCard(user.sub, cardId, parsed.data.score);

    // Record the review as an EngagementEvent.
    await db.engagementEvent.create({
      data: {
        userId: user.sub,
        eventType: "srs.review",
        metadata: { cardId, score: parsed.data.score, ease: result.ease } as unknown as Prisma.InputJsonValue,
      },
    });

    return apiSuccess({
      ...result,
      mastered: result.ease === "easy" && result.interval >= 14,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return apiNotFound("Card not found");
    }
    return apiServerError(err instanceof Error ? err.message : "Review failed");
  }
}
