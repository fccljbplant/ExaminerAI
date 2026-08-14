// src/app/api/admin/portal-flags/route.ts — Enable portal v2 flags.
// Platform-admin endpoint to flip v2 portal flags on the production DB.
//
// POST (no body): enables the default set (learner + submissions) —
// backward compatible with the original one-time call.
// POST { portals: ["learner","exams","instructor","org","platform",…] }:
// enables exactly those portal flags (feature_portal_<name>_v2).
// POST { portals: [...], enable: false }: disables them (rollback).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const PORTALS = [
  "learner",
  "study_flow",
  "submissions",
  "exams",
  "instructor",
  "org",
  "platform",
] as const;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let portals: readonly string[] = ["learner", "submissions"];
  let enable = true;
  try {
    const body = await req.json().catch(() => null);
    if (body) {
      if (Array.isArray(body.portals) && body.portals.length > 0) {
        portals = body.portals.filter((p): p is string => typeof p === "string");
      }
      if (typeof body.enable === "boolean") enable = body.enable;
    }
  } catch {
    // body absent → default set
  }

  const unknown = portals.filter((p) => !(PORTALS as readonly string[]).includes(p));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown portal(s): ${unknown.join(", ")}`, portals: PORTALS },
      { status: 400 },
    );
  }

  try {
    for (const portal of portals) {
      const key = `feature_portal_${portal}_v2`;
      await db.setting.upsert({
        where: { key },
        update: { value: String(enable) },
        create: { key, value: String(enable) },
      });
    }

    const flags = await db.setting.findMany({
      where: { key: { startsWith: "feature_portal_" } },
      select: { key: true, value: true },
      orderBy: { key: "asc" },
    });

    return NextResponse.json({
      ok: true,
      message: `Portal v2 flags ${enable ? "enabled" : "disabled"}`,
      portals: portals.map((p) => `feature_portal_${p}_v2`),
      flags: flags.map((f) => ({ key: f.key, value: f.value })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
