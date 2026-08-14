/**
 * POST /api/v2/events — Engagement event ingestion (REDESIGN-P4 §1, W3)
 *
 * Accepts typed engagement events from the learner portal and writes
 * them to the EngagementEvent table. Powers analytics + study-flow.
 *
 * Body: { eventType, courseId?, sentiment?, metadata? }
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
import { EngagementEventSchema } from "@/modules/learn/contracts";
import { isStudyFlowEnabled } from "@/modules/learn/lib/study-flow-flag";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["learner", "student", "teacher", "admin"]);

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ALLOWED_ROLES.has(user.role)) {
    return apiError("Insufficient role", "FORBIDDEN", 403);
  }
  if (!(await isStudyFlowEnabled())) {
    return apiError("Study Flow is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = EngagementEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { eventType, courseId, sentiment, metadata } = parsed.data;

  try {
    const event = await db.engagementEvent.create({
      data: {
        userId: user.sub,
        courseId: courseId ?? null,
        eventType,
        sentiment: sentiment ?? null,
        metadata: metadata
          ? (metadata as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      select: { id: true, eventType: true, createdAt: true },
    });

    return apiSuccess(event, 201);
  } catch (err) {
    return apiServerError(err instanceof Error ? err.message : "Event creation failed");
  }
}
