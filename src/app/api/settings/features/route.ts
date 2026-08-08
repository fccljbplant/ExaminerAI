import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/settings/features — returns all feature flags.
 *  Available to all authenticated users (they need to know what's enabled). */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await db.setting.findMany({
      where: { key: { startsWith: "feature_" } },
    });
    const features: Record<string, boolean> = {};
    for (const s of settings) {
      features[s.key.replace("feature_", "")] = s.value === "true";
    }
    // Defaults: all features enabled
    const defaults: Record<string, boolean> = {
      ai_enabled: true,
      weekly_test_enabled: true,
      signup_enabled: true,
      ai_tutor_enabled: true,
      messages_enabled: true,
    };
    return NextResponse.json({ features: { ...defaults, ...features } });
  } catch {
    return NextResponse.json({ features: {} });
  }
}

/** POST /api/settings/features — toggle a feature flag.
 *  Admin only. Body: { key: string, value: boolean } */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing settings"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { key, value } = body as { key?: string; value?: boolean };

  if (!key || typeof value !== "boolean") {
    return NextResponse.json({ error: "key and value (boolean) required" }, { status: 400 });
  }

  const settingKey = `feature_${key}`;
  await db.setting.upsert({
    where: { key: settingKey },
    update: { value: String(value) },
    create: { key: settingKey, value: String(value) },
  });

  return NextResponse.json({ ok: true, key, value });
}
