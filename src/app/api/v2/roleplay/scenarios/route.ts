/**
 * GET /api/v2/roleplay/scenarios — published roleplay scenarios.
 *
 * Available to any authenticated user. The platform scenario library is
 * lazily seeded on first read (idempotent upserts) — no build-time prod
 * DB writes are involved (2026-08-17).
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { listPublishedScenarios } from "@/modules/roleplay/lib/roleplay-db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const scenarios = await listPublishedScenarios();
  return apiSuccess({ scenarios });
}
