import { db } from "@/lib/db";

/**
 * Marketplace filter options — shared between the public API route and the
 * server-rendered marketplace pages so both stay in sync.
 */
export const MARKETPLACE_CATEGORIES = [
  { value: "web-dev", label: "Web Development" },
  { value: "cloud", label: "Cloud & DevOps" },
  { value: "data", label: "Data & AI" },
  { value: "mobile", label: "Mobile" },
  { value: "security", label: "Security" },
  { value: "soft-skills", label: "Soft Skills" },
  { value: "technology", label: "Technology" },
] as const;

export const MARKETPLACE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export interface MarketplaceListFilters {
  category?: string;
  level?: string;
  search?: string;
  featured?: boolean;
  free?: boolean;
}

export interface MarketplaceCourseListItem {
  id: string;
  name: string;
  subtitle: string | null;
  category: string;
  level: string;
  price: number;
  currency: string;
  durationWeeks: number;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  thumbnailUrl: string | null;
  instructorName: string | null;
  featured: boolean;
}

/** Fetch the public marketplace listing — only `published: true` courses,
 *  sorted featured-first then by enrollmentCount desc. */
export async function fetchMarketplaceCourses(
  filters: MarketplaceListFilters = {}
): Promise<MarketplaceCourseListItem[]> {
  const where: Record<string, unknown> = { published: true };
  if (filters.category) where.category = filters.category;
  if (filters.level) where.level = filters.level;
  if (filters.featured) where.featured = true;
  if (filters.free) where.price = 0;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { subtitle: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }

  const courses = await db.course.findMany({
    where,
    select: {
      id: true,
      name: true,
      subtitle: true,
      category: true,
      level: true,
      price: true,
      currency: true,
      durationWeeks: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      thumbnailUrl: true,
      instructorName: true,
      featured: true,
    },
    orderBy: [
      { featured: "desc" },
      { enrollmentCount: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  return courses;
}

export interface MarketplaceCourseDetail {
  id: string;
  name: string;
  subtitle: string | null;
  description: string;
  category: string;
  level: string;
  domain: string;
  price: number;
  currency: string;
  durationWeeks: number;
  language: string;
  thumbnailUrl: string | null;
  trailerVideoUrl: string | null;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  featured: boolean;
  instructorName: string | null;
  instructorBio: string | null;
  skillsVerified: string[];
  whatYouWillLearn: string[];
  prerequisites: string[];
  weeks: Array<{
    id: string;
    weekNumber: number;
    phase: string;
    milestone: string;
    days: Array<{
      id: string;
      day: number;
      title: string;
      objective: string;
      topicsCovered: string[];
    }>;
  }>;
}

/** Fetch a single published course's full marketing detail.
 *  Returns null if the course is not found or not published. */
export async function fetchMarketplaceCourseDetail(id: string): Promise<MarketplaceCourseDetail | null> {
  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subtitle: true,
      description: true,
      category: true,
      level: true,
      domain: true,
      price: true,
      currency: true,
      durationWeeks: true,
      language: true,
      thumbnailUrl: true,
      trailerVideoUrl: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      featured: true,
      published: true,
      instructorName: true,
      instructorBio: true,
      skillsVerified: true,
      whatYouWillLearn: true,
      prerequisites: true,
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: {
          id: true,
          weekNumber: true,
          phase: true,
          milestone: true,
          days: {
            orderBy: { day: "asc" },
            select: {
              id: true,
              day: true,
              title: true,
              objective: true,
              topicsCovered: true,
            },
          },
        },
      },
    },
  });

  if (!course || !course.published) return null;

  const parseJSON = <T,>(str: string | null, fallback: T): T => {
    try { return str ? JSON.parse(str) as T : fallback; } catch { return fallback; }
  };

  return {
    id: course.id,
    name: course.name,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category,
    level: course.level,
    domain: course.domain,
    price: course.price,
    currency: course.currency,
    durationWeeks: course.durationWeeks,
    language: course.language,
    thumbnailUrl: course.thumbnailUrl,
    trailerVideoUrl: course.trailerVideoUrl,
    rating: course.rating,
    reviewCount: course.reviewCount,
    enrollmentCount: course.enrollmentCount,
    featured: course.featured,
    instructorName: course.instructorName,
    instructorBio: course.instructorBio,
    skillsVerified: parseJSON<string[]>(course.skillsVerified, []),
    whatYouWillLearn: parseJSON<string[]>(course.whatYouWillLearn, []),
    prerequisites: parseJSON<string[]>(course.prerequisites, []),
    weeks: course.weeks.map(w => ({
      id: w.id,
      weekNumber: w.weekNumber,
      phase: w.phase,
      milestone: w.milestone,
      days: w.days.map(d => ({
        id: d.id,
        day: d.day,
        title: d.title,
        objective: d.objective,
        topicsCovered: parseJSON<string[]>(d.topicsCovered, []),
      })),
    })),
  };
}

/** Look up a Certificate by its public credentialId (Phase 6 marketplace
 *  credentials) OR by its legacy verifyToken (backward-compat with
 *  pre-Phase-6 certificates). Returns null if not found. */
export async function fetchCertificateForVerification(credentialId: string) {
  // Format heuristic: Phase-6 credentialIds are short, dashed codes like
  // "TRN-AI-2026-08-NA-87". Legacy verifyTokens are 64-char hex strings.
  const looksLikeLegacyToken = /^[a-f0-9]{32,}$/i.test(credentialId);

  const certificate = await db.certificate.findFirst({
    where: looksLikeLegacyToken
      ? { verifyToken: credentialId }
      : { OR: [{ credentialId }, { verifyToken: credentialId }] },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          category: true,
          level: true,
          durationWeeks: true,
          instructorName: true,
        },
      },
    },
  });

  return certificate;
}
