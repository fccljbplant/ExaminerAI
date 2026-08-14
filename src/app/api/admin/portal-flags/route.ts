// src/app/api/admin/portal-flags/route.ts — Enable portal v2 flags.
// One-time admin endpoint to flip feature flags on production DB.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.setting.upsert({
      where: { key: "feature_portal_learner_v2" },
      update: { value: "true" },
      create: { key: "feature_portal_learner_v2", value: "true" },
    });
    await db.setting.upsert({
      where: { key: "feature_portal_submissions_v2" },
      update: { value: "true" },
      create: { key: "feature_portal_submissions_v2", value: "true" },
    });

    const flags = await db.setting.findMany({
      where: { key: { startsWith: "feature_portal_" } },
      select: { key: true, value: true },
    });

    return NextResponse.json({
      ok: true,
      message: "Portal v2 flags enabled",
      flags: flags.map(f => ({ key: f.key, value: f.value })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
