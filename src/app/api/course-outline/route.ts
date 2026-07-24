import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/course-outline — returns the course outline content.
 * POST /api/course-outline — admin updates the content. Body: { content: string }
 */

const OUTLINE_KEY = "course_outline";

async function getSetting(key: string): Promise<string | null> {
  try {
    // L3-security: use Prisma client instead of raw SQL ($queryRaw).
    // The Setting model is defined in prisma/schema.prisma.
    const result = await db.setting.findUnique({ where: { key } });
    return result?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  try {
    // L3-security: use Prisma upsert instead of raw SQL ($executeRaw).
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  } catch {
    // give up silently — the route is best-effort
  }
}

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const content = await getSetting(OUTLINE_KEY);
  return NextResponse.json({ content: content || null });
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("editing course outlines"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const content = body.content as string;
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 500_000) {
    return NextResponse.json({ error: "Content too large (max 500KB)" }, { status: 400 });
  }
  await setSetting(OUTLINE_KEY, content);
  return NextResponse.json({ ok: true });
}
