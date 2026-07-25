import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/institutions — register a new institution.
 *  Admin/demo only for now (no public self-serve signup yet).
 *  Body: { name, contactEmail, logoUrl? } */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing institutions"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, contactEmail, logoUrl } = body as {
    name?: string; contactEmail?: string; logoUrl?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!contactEmail?.trim()) return NextResponse.json({ error: "contactEmail is required" }, { status: 400 });
  if (contactEmail.length > 500) return NextResponse.json({ error: "contactEmail too long" }, { status: 400 });

  const institution = await db.institution.create({
    data: {
      name: name.trim(),
      contactEmail: contactEmail.trim(),
      logoUrl: logoUrl?.trim() || null,
    },
  });

  return NextResponse.json({ institution });
}

/** GET /api/institutions — list all institutions. Staff-only. */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const institutions = await db.institution.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { users: true, courses: true, certificates: true } },
    },
  });

  return NextResponse.json({ institutions });
}
