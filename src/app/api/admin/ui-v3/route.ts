// src/app/api/admin/ui-v3/route.ts — Toggle v3 UI flag.
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { enable, orgId } = body as { enable?: boolean; orgId?: string };

  const key = orgId ? `feature_ui_v3_org:${orgId}` : "feature_ui_v3";
  const value = enable === false ? "false" : "true";

  try {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.sub,
        actorName: user.name ?? user.email,
        actorRole: user.role,
        action: "feature_flag.update",
        targetType: "setting",
        targetId: key,
        afterJson: JSON.stringify({ key, value }),
        metadata: JSON.stringify({ v3: true }),
      },
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
    const global = await db.setting.findUnique({ where: { key: "feature_ui_v3" } });
    return NextResponse.json({ enabled: global?.value === "true" });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
