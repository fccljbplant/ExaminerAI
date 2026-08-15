/**
 * PUT /api/auth/avatar — set the caller's profile picture.
 * DELETE /api/auth/avatar — remove it.
 *
 * W16: profile pictures on the v2 stack. The client crops + resizes to
 * 128×128 and compresses to <=20KB; the server re-validates:
 *   - data:image/(png|jpeg|webp) prefix
 *   - decoded bytes <= 20_000
 * Then stores the data URL on User.avatarData.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_BYTES = 20_000;
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { dataUrl?: string };
  const dataUrl = (body.dataUrl ?? "").trim();
  if (!dataUrl) return NextResponse.json({ error: "dataUrl required" }, { status: 400 });

  const match = DATA_IMAGE_RE.exec(dataUrl);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid image — expected a base64 data URL (png/jpeg/webp)" },
      { status: 400 },
    );
  }
  // Base64 size guard without allocating huge buffers: 20KB of bytes
  // encodes to ~27KB of base64.
  if (match[2].length > 27_400) {
    return NextResponse.json(
      { error: "Image too large — max 20KB after compression" },
      { status: 400 },
    );
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large — max 20KB after compression" },
      { status: 400 },
    );
  }

  await db.user.update({ where: { id: user.sub }, data: { avatarData: dataUrl } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({ where: { id: user.sub }, data: { avatarData: null } });
  return NextResponse.json({ ok: true });
}
