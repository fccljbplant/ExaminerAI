/**
 * GET /api/learn/me/xp?courseId=...&limit=50
 *
 * Returns the authed user's XP history. Optionally filtered by course.
 *
 * Returns:
 *   { total, level, recent: [{ id, amount, reason, referenceId, courseId, createdAt }] }
 */

import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { getTotalXP, getLearnerLevel, getXPHistory } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId") ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50;

  if (limitRaw < 1 || limitRaw > 200) {
    return apiValidationError({ limit: "limit must be between 1 and 200" });
  }

  const [total, recent] = await Promise.all([
    getTotalXP(user.sub),
    getXPHistory(user.sub, courseId, limit),
  ]);
  const level = getLearnerLevel(total);

  return apiSuccess({
    total,
    level: level.name,
    recent,
  });
}
