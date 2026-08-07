import { NextRequest, NextResponse } from "next/server";
import { fetchMarketplaceCourseDetail } from "@/lib/marketplace";

/**
 * GET /api/marketplace/courses/[id] — PUBLIC course detail.
 *
 * Phase 6. No auth required. Returns the full marketing-rich course detail
 * (whatYouWillLearn, prerequisites, skillsVerified, instructorBio,
 * description, plus a curriculum outline of weeks → days).
 *
 * Only returns if `published: true` — unpublished courses are 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const course = await fetchMarketplaceCourseDetail(id);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  return NextResponse.json({ course });
}
