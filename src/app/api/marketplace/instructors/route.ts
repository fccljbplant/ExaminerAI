import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/marketplace/instructors — PUBLIC.
 *
 * Returns all instructors who have at least one published course. Used by
 * the instructor directory (and indirectly by instructor profile pages).
 *
 * Per-instructor rollup:
 *   - instructorName (display name)
 *   - instructorBio (may be null — we take the most-recent non-null bio
 *     from the instructor's published courses, since the bio is stored
 *     per-course rather than per-instructor in this version of the schema)
 *   - courseCount   — number of published courses
 *   - totalEnrollments — sum of enrollmentCount across their courses
 *   - avgRating     — weighted avg of `rating` across published courses
 *                     with at least one review
 *
 * The endpoint returns a flat list. The caller can filter / group as needed.
 */
export async function GET() {
  // Pull every published course that has a non-null instructorName.
  const courses = await db.course.findMany({
    where: {
      published: true,
      instructorName: { not: null },
    },
    select: {
      id: true,
      name: true,
      category: true,
      level: true,
      price: true,
      currency: true,
      durationWeeks: true,
      thumbnailUrl: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      featured: true,
      instructorName: true,
      instructorBio: true,
      subtitle: true,
    },
    orderBy: [
      { featured: "desc" },
      { enrollmentCount: "desc" },
    ],
  });

  // Group by instructorName (case-sensitive — "Dr. Amira Haddad" is one
  // instructor, "amira hadad" is treated as a different one).
  const byInstructor = new Map<string, {
    instructorName: string;
    instructorBio: string | null;
    courses: typeof courses;
    totalEnrollments: number;
    ratingSum: number;
    ratingCount: number;
  }>();

  for (const c of courses) {
    const name = (c.instructorName ?? "").trim();
    if (!name) continue;
    const key = name;
    let entry = byInstructor.get(key);
    if (!entry) {
      entry = {
        instructorName: name,
        instructorBio: null,
        courses: [],
        totalEnrollments: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      byInstructor.set(key, entry);
    }
    entry.courses.push(c);
    entry.totalEnrollments += c.enrollmentCount;
    if (c.reviewCount > 0) {
      entry.ratingSum += c.rating * c.reviewCount;
      entry.ratingCount += c.reviewCount;
    }
    // Prefer the first non-null bio across the instructor's courses.
    if (!entry.instructorBio && c.instructorBio) {
      entry.instructorBio = c.instructorBio;
    }
  }

  const instructors = Array.from(byInstructor.values())
    .map((e) => ({
      instructorName: e.instructorName,
      instructorBio: e.instructorBio,
      courseCount: e.courses.length,
      totalEnrollments: e.totalEnrollments,
      avgRating:
        e.ratingCount > 0
          ? Math.round((e.ratingSum / e.ratingCount) * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.totalEnrollments - a.totalEnrollments);

  return NextResponse.json({ instructors });
}
