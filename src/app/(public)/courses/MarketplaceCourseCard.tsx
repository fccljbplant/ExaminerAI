import Link from "next/link";
import { Star, Users, Clock, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Card, CardContent } from "@/modules/ui/card";
import type { MarketplaceCourseListItem } from "@/lib/marketplace";
import { formatPrice } from "@/lib/format";
import WishlistButton from "./WishlistButton";

/**
 * MarketplaceCourseCard — shared course card for the public marketplace.
 *
 * Used by:
 *   - /courses (homepage listing)
 *   - /courses/category/[category] (category landing page)
 *   - /instructors/[instructorName] (instructor profile)
 *
 * Props:
 *   - course:   a MarketplaceCourseListItem (or any compatible subset)
 *   - showWishlist: whether to render the wishlist button (default true)
 *   - highlightFeatured: render the featured ring when course.featured=true
 *   - ctaLabel: the button label (default "View Course"). Instructor profile may override.
 */

export interface MarketplaceCourseCardProps {
  course: MarketplaceCourseListItem;
  showWishlist?: boolean;
  highlightFeatured?: boolean;
  ctaLabel?: string;
}

export default function MarketplaceCourseCard({
  course,
  showWishlist = true,
  highlightFeatured = false,
  ctaLabel = "View Course",
}: MarketplaceCourseCardProps) {
  const isFree = course.price === 0;
  const showFeaturedBorder = highlightFeatured && course.featured;

  return (
    <Card
      className={`overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md ${
        showFeaturedBorder || course.featured
          ? "border-brand/60 ring-1 ring-brand/30"
          : ""
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-subtle flex items-center justify-center overflow-hidden">
        {course.thumbnailUrl ? (
           
          <img
            src={course.thumbnailUrl}
            alt={course.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryGradient category={course.category} name={course.name} />
        )}
        {course.featured && (
          <Badge className="absolute top-2 left-2 bg-brand text-on-brand">
            <Sparkles className="h-3 w-3 mr-1" /> Featured
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2 capitalize">
          {course.category.replace("-", " ")}
        </Badge>
        {showWishlist && (
          <div className="absolute bottom-2 right-2">
            <WishlistButton courseId={course.id} variant="icon" />
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title + level */}
        <div>
          <h3 className="font-semibold text-base line-clamp-2 leading-snug">{course.name}</h3>
          {course.subtitle && (
            <p className="text-sm text-fg-muted line-clamp-2 mt-1">{course.subtitle}</p>
          )}
        </div>

        {/* Instructor */}
        {course.instructorName && (
          <p className="text-xs text-fg-muted">By {course.instructorName}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
          <Badge variant="outline" className="capitalize">{course.level}</Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {course.durationWeeks}w
          </span>
          {course.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-growth-amber" />
              {course.rating.toFixed(1)} ({course.reviewCount})
            </span>
          )}
          {course.enrollmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {course.enrollmentCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <div>
            {isFree ? (
              <span className="text-base font-semibold text-growth-sage">Free</span>
            ) : (
              <span className="text-base font-semibold">
                {formatPrice(course.price, course.currency)}
              </span>
            )}
          </div>
          <Button asChild size="sm">
            <Link href={`/courses/${course.id}`}>{ctaLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Category-based gradient placeholder when no thumbnail is available.
 *  Uses the course category to pick a professional color scheme.
 *  Falls back to a generic BookOpen icon for unknown categories. */
export function CategoryGradient({ category, name }: { category: string; name: string }) {
  const gradients: Record<string, string> = {
    technology: "from-blue-600 via-indigo-600 to-purple-600",
    engineering: "from-orange-600 via-amber-600 to-yellow-600",
    business: "from-emerald-600 via-teal-600 to-cyan-600",
    finance: "from-green-600 via-emerald-600 to-teal-600",
    healthcare: "from-rose-600 via-pink-600 to-red-600",
    manufacturing: "from-slate-600 via-gray-600 to-zinc-600",
    hr: "from-violet-600 via-purple-600 to-fuchsia-600",
    compliance: "from-red-600 via-orange-600 to-amber-600",
    "soft-skills": "from-cyan-600 via-sky-600 to-blue-600",
    other: "from-indigo-600 via-blue-600 to-cyan-600",
  };
  const gradient = gradients[category] || gradients.other;
  const initials = name
    .split(" ")
    .slice(0, 3)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`h-full w-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}
    >
      {initials ? (
        <span className="text-4xl font-bold text-white/90 drop-shadow-lg">{initials}</span>
      ) : (
        <BookOpen className="h-10 w-10 text-white/80" />
      )}
      <span className="text-xs text-white/70 uppercase tracking-wider font-medium">
        {category.replace("-", " ")}
      </span>
    </div>
  );
}
