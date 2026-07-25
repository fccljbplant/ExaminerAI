import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/** PATCH /api/institutions/[id] — update institution (logo URL, name, contact).
 *  Admin/demo only.
 *  Body: { name?, contactEmail?, logoUrl? } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("managing institutions"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, contactEmail, logoUrl } = body as {
    name?: string; contactEmail?: string; logoUrl?: string;
  };

  const existing = await db.institution.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

  const updated = await db.institution.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(contactEmail?.trim() && { contactEmail: contactEmail.trim() }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
    },
  });

  return NextResponse.json({ institution: updated });
}

/** GET /api/institutions/[id] — get a single institution. Staff-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const institution = await db.institution.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, courses: true, certificates: true } },
    },
  });

  if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  return NextResponse.json({ institution });
}
