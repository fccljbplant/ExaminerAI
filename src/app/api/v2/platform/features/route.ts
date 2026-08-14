/**
 * GET /api/v2/platform/features — list global feature flags
 * PATCH /api/v2/platform/features — toggle a flag { key, value }
 *
 * W11 audit: V1 FeaturesPanel restored on the v2 stack. Flags live in
 * the Setting table as `feature_<name>`; portal rollout flags use
 * `feature_portal_<name>_v2`. Platform admin only; writes are audited.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export const FEATURE_KEYS = [
  "ai_enabled",
  "ai_tutor_enabled",
  "weekly_test_enabled",
  "signup_enabled",
  "messages_enabled",
] as const;

export const PORTAL_KEYS = ["learner", "study_flow", "submissions", "exams", "instructor", "org", "platform"] as const;

async function requirePlatformAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; denied?: never }
  | { user?: never; denied: ReturnType<typeof apiError> }
> {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized() };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403) };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403) };
  }
  return { user };
}

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const keys = [
    ...FEATURE_KEYS.map((k) => `feature_${k}`),
    ...PORTAL_KEYS.map((k) => `feature_portal_${k}_v2`),
  ];
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const feature = FEATURE_KEYS.map((k) => ({
    key: k,
    enabled: (map.get(`feature_${k}`) ?? "true") === "true",
  }));
  const portals = PORTAL_KEYS.map((k) => ({
    key: k,
    enabled: (map.get(`feature_portal_${k}_v2`) ?? "false") === "true",
  }));

  return apiSuccess({ feature, portals });
}

export async function PATCH(req: Request) {
  const auth = await requirePlatformAdmin();
  if (!auth.user) return auth.denied;

  const body = (await req.json().catch(() => ({}))) as { key?: string; value?: boolean };
  const key = (body.key ?? "").trim();
  const value = body.value === true;

  const knownFeature = FEATURE_KEYS.includes(key as (typeof FEATURE_KEYS)[number]);
  const knownPortal = PORTAL_KEYS.includes(key as (typeof PORTAL_KEYS)[number]);
  const dbKey = knownFeature
    ? `feature_${key}`
    : knownPortal
      ? `feature_portal_${key}_v2`
      : null;
  if (!dbKey) return apiError("Unknown feature key", "INVALID_INPUT", 400);

  await db.setting.upsert({
    where: { key: dbKey },
    update: { value: value ? "true" : "false" },
    create: { key: dbKey, value: value ? "true" : "false" },
  });
  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "setting_update",
    target: { type: "Setting", id: dbKey },
    metadata: { reason: `feature toggle ${value ? "enabled" : "disabled"} via platform features page` },
  });

  return apiSuccess({ key, enabled: value });
}
