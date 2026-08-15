/**
 * GET /api/v2/platform/ai-limits — admin AI rate limits + demo AI toggle
 * PUT /api/v2/platform/ai-limits — write them (Setting rows)
 *
 * W16: V1 AILimitsPanel restored on the v2 stack. Keys match the
 * ai-rate-limits module: ai_test_daily_limit, ai_tutor_daily_limit,
 * ai_assistant_daily_limit, demo_ai_enabled.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit-log";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";

export const runtime = "nodejs";

const LIMIT_KEYS = {
  test: "ai_test_daily_limit",
  tutor: "ai_tutor_daily_limit",
  assistant: "ai_assistant_daily_limit",
} as const;

const DEFAULTS: Record<keyof typeof LIMIT_KEYS, number> = { test: 50, tutor: 150, assistant: 100 };

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized(), user: null };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403), user: null };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403), user: null };
  }
  return { denied: null, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.denied) return auth.denied;

  const keys = [...Object.values(LIMIT_KEYS), "demo_ai_enabled"];
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return apiSuccess({
    limits: {
      test: Number(map.get(LIMIT_KEYS.test) ?? DEFAULTS.test),
      tutor: Number(map.get(LIMIT_KEYS.tutor) ?? DEFAULTS.tutor),
      assistant: Number(map.get(LIMIT_KEYS.assistant) ?? DEFAULTS.assistant),
    },
    demoAiEnabled: (map.get("demo_ai_enabled") ?? "true") === "true",
  });
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (auth.denied || !auth.user) return auth.denied;

  const body = (await req.json().catch(() => ({}))) as {
    limits?: { test?: number; tutor?: number; assistant?: number };
    demoAiEnabled?: boolean;
  };

  const writes: { key: string; value: string }[] = [];
  if (body.limits) {
    for (const cat of ["test", "tutor", "assistant"] as const) {
      const v = body.limits[cat];
      if (v === undefined) continue;
      if (!Number.isInteger(v) || v < 1 || v > 10_000) {
        return apiError(`${cat} limit must be an integer 1-10000`, "VALIDATION_ERROR", 400);
      }
      writes.push({ key: LIMIT_KEYS[cat], value: String(v) });
    }
  }
  if (body.demoAiEnabled !== undefined) {
    writes.push({ key: "demo_ai_enabled", value: body.demoAiEnabled ? "true" : "false" });
  }
  if (writes.length === 0) return apiError("Nothing to update", "VALIDATION_ERROR", 400);

  for (const w of writes) {
    await db.setting.upsert({
      where: { key: w.key },
      update: { value: w.value },
      create: { key: w.key, value: w.value },
    });
  }

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "ai_limits_updated",
    target: { type: "Setting", id: "ai_limits" },
    metadata: { writes: writes.map((w) => w.key) },
  });

  return apiSuccess({ ok: true });
}
