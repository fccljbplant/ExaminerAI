import { hasRole, ADMIN_ROLES, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

/**
 * GET /api/settings/ai-limits — returns the current AI rate-limit config
 * + demo AI enabled flag.
 *
 * Admin only. Demo is explicitly excluded — demo cannot view or change
 * these settings (admin panel is hidden from demo).
 */

const DEFAULTS = {
  ai_test_daily_limit: 50,
  ai_tutor_daily_limit: 150,
  ai_assistant_daily_limit: 100,
  demo_ai_enabled: true,
};

export async function GET() {
  const payload = await getAuthUser();
  if (!payload || payload.role === UserRole.DEMO) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await db.setting.findMany({
      where: { key: { in: Object.keys(DEFAULTS) } },
    });
    const config: Record<string, number | boolean> = { ...DEFAULTS };
    for (const s of settings) {
      if (s.key === "demo_ai_enabled") {
        config[s.key] = s.value === "true";
      } else {
        const parsed = parseInt(s.value, 10);
        if (!isNaN(parsed)) config[s.key] = parsed;
      }
    }
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ config: DEFAULTS });
  }
}

/**
 * POST /api/settings/ai-limits — update AI rate-limit config + demo AI toggle.
 * Admin only. Demo is explicitly excluded.
 *
 * Body: { ai_test_daily_limit?, ai_tutor_daily_limit?, ai_assistant_daily_limit?, demo_ai_enabled? }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing AI limits"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || payload.role === UserRole.DEMO) {
    return NextResponse.json({ error: "Demo accounts cannot manage AI limits" }, { status: 403 });
  }
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, string> = {};

  // Validate + queue updates
  if (typeof body.ai_test_daily_limit === "number") {
    if (body.ai_test_daily_limit < 0 || body.ai_test_daily_limit > 10000) {
      return NextResponse.json({ error: "ai_test_daily_limit must be between 0 and 10000" }, { status: 400 });
    }
    updates.ai_test_daily_limit = String(body.ai_test_daily_limit);
  }
  if (typeof body.ai_tutor_daily_limit === "number") {
    if (body.ai_tutor_daily_limit < 0 || body.ai_tutor_daily_limit > 10000) {
      return NextResponse.json({ error: "ai_tutor_daily_limit must be between 0 and 10000" }, { status: 400 });
    }
    updates.ai_tutor_daily_limit = String(body.ai_tutor_daily_limit);
  }
  if (typeof body.ai_assistant_daily_limit === "number") {
    if (body.ai_assistant_daily_limit < 0 || body.ai_assistant_daily_limit > 10000) {
      return NextResponse.json({ error: "ai_assistant_daily_limit must be between 0 and 10000" }, { status: 400 });
    }
    updates.ai_assistant_daily_limit = String(body.ai_assistant_daily_limit);
  }
  if (typeof body.demo_ai_enabled === "boolean") {
    updates.demo_ai_enabled = String(body.demo_ai_enabled);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    // Upsert each setting
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        db.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    // Audit log: admin changed AI limits or demo AI toggle
    const isDemoToggle = "demo_ai_enabled" in updates;
    logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: isDemoToggle ? "demo_ai_toggled" : "ai_limits_changed",
      target: { type: "system", id: "ai-limits" },
      after: updates,
      req,
    }).catch((err) => { logger.warn("Operation failed", { err }); });

    return NextResponse.json({
      ok: true,
      updated: Object.keys(updates),
      config: { ...DEFAULTS, ...Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, k === "demo_ai_enabled" ? v === "true" : parseInt(v, 10)])
      ) },
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Failed to update AI limits",
    }, { status: 500 });
  }
}
