// src/app/api/admin/ui-v3/route.ts — Toggle v3 UI flag.
// Any authenticated user can toggle — this is a UI preference, not a security gate.
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { enable } = body as { enable?: boolean };

  const key = "feature_ui_v3";
  const value = enable === false ? "false" : "true";

  try {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json({ ok: true, key, value });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const setting = await db.setting.findUnique({ where: { key: "feature_ui_v3" } });
    return NextResponse.json({ enabled: setting?.value === "true" });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
