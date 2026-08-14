/**
 * GET /api/v2/instructor/home — I1 Home aggregate (REDESIGN-P4 §2 I1, W6)
 *
 * One request feeds the instructor home fold: queue count + queue
 * preview, at-risk count + list, and the roster total. All scoped to
 * courses the instructor teaches (same scope as reviewQueue/students).
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";
import { reviewQueue } from "@/modules/submission/lib/submission-db";
import { isSubmissionsEnabled } from "@/modules/submission/lib/submission-flag";
import { GET as GET_Students } from "../students/route";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }
  if (!(await isSubmissionsEnabled())) {
    return apiError("Submissions are not enabled yet", "FORBIDDEN", 403);
  }

  // Queue preview (same service the I3 queue uses — one source of truth).
  const { items } = await reviewQueue(user.sub, { limit: 5 });

  // At-risk roster: compose the students route in-process (no HTTP hop).
  const rosterUrl = new URL(req.url);
  rosterUrl.pathname = "/api/v2/instructor/students";
  rosterUrl.search = "risk=1";
  const studentsRes = await GET_Students(new NextRequest(rosterUrl, { method: "GET" }));
  const body = await studentsRes.json();
  const atRisk = body?.ok && Array.isArray(body?.data?.items) ? body.data.items : [];

  return apiSuccess({
    queue: { count: items.length, preview: items.slice(0, 5) },
    atRisk: { count: atRisk.length, items: atRisk.slice(0, 5) },
    studentsTotal: body?.data?.total ?? 0,
  });
}
