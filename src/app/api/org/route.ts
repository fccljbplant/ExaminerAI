import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getUserOrg, getOrgMembers, getOrgStats } from "@/lib/org";
import { logger } from "@/lib/logger";

export async function GET() {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "org_admin" && payload.role !== "platform_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await getUserOrg(payload.sub);
  if (!member) return NextResponse.json({ error: "No organization found" }, { status: 404 });

  const [members, stats] = await Promise.all([
    getOrgMembers(member.orgId),
    getOrgStats(member.orgId),
  ]);

  return NextResponse.json({ org: member.org, members, stats });
}

export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || payload.role !== "platform_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, slug, plan, seats } = body as { name?: string; slug?: string; plan?: string; seats?: number };
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  const org = await db.organization.create({
    data: { name: name.trim(), slug: slug.trim(), plan: plan || "free", seats: seats || 5 },
  });
  return NextResponse.json({ org });
}
