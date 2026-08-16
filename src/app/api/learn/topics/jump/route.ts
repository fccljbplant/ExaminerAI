/**
 * POST /api/learn/topics/jump?courseId=...
 * Body: { week, day }
 *
 * Re-learn a previously COMPLETED topic (or return to the current one).
 * Jumping ahead to locked topics is refused server-side.
 */

import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { jumpToTopic } from "@/modules/learn/lib/today-topic";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  const body = await req.json().catch(() => ({}));
  const { week, day } = body as { week?: number; day?: number };
  if (typeof week !== "number" || typeof day !== "number") {
    return apiValidationError({ week: "week and day are required" });
  }

  const ok = await jumpToTopic(user.sub, courseId, week, day);
  if (!ok) {
    return apiError(
      "You can only revisit topics you have already completed (or your current topic).",
      "FORBIDDEN",
      403,
    );
  }

  return apiSuccess({ jumped: { week, day } });
}
