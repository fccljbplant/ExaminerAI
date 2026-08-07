import { NextRequest, NextResponse } from "next/server";
import { fetchMarketplaceCourses } from "@/lib/marketplace";

/**
 * GET /api/marketplace/courses — PUBLIC marketplace listing.
 *
 * Phase 6. No auth required — anyone (prospective students, employers, search
 * engines) can browse published courses.
 *
 * Query params:
 *   ?category=   filter by category (web-dev, cloud, data, mobile, security, soft-skills)
 *   ?level=      filter by level (beginner, intermediate, advanced)
 *   ?search=     case-insensitive search across name + subtitle + description
 *   ?featured=1  only return featured courses
 *   ?free=1      only return courses with price = 0
 *
 * Only returns courses where `published: true`. Sorted by featured first,
 * then by enrollmentCount desc (most popular first).
 *
 * Returns: id, name, subtitle, category, level, price, currency,
 *          durationWeeks, rating, reviewCount, enrollmentCount,
 *          thumbnailUrl, instructorName, featured
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category")?.trim() || undefined;
  const level = url.searchParams.get("level")?.trim() || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const featured = url.searchParams.get("featured") === "1" || url.searchParams.get("featured") === "true";
  const free = url.searchParams.get("free") === "1" || url.searchParams.get("free") === "true";

  const courses = await fetchMarketplaceCourses({ category, level, search, featured, free });
  return NextResponse.json({ courses });
}
