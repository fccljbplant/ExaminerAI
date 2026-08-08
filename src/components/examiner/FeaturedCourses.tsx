"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Users, Clock, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";

/**
 * FeaturedCourses — client-side preview of the top featured courses,
 * shown alongside the login form on the landing page.
 *
 * Fetches published + featured courses from the public marketplace API
 * (no auth required). Falls back gracefully to a "Browse All" CTA if the
 * API is unreachable or no featured courses exist yet.
 */

interface MarketplaceCourse {
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

interface CoursesResponse {
  courses: MarketplaceCourse[];
}

export default function FeaturedCourses() {
  const [courses, setCourses] = useState<MarketplaceCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<CoursesResponse>("/api/marketplace/courses?featured=true");
        if (cancelled) return;
        setCourses((res.courses || []).slice(0, 4));
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
      </div>
    );
  }

  if (errored || courses.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">
          Explore our full catalogue of professional, project-based courses.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4 border-border">
          <Link href="/courses">
            Browse All Courses <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {courses.map((course) => {
          const isFree = course.price === 0;
          return (
            <Card
              key={course.id}
              className="border-border/60 bg-card/60 backdrop-blur py-0 gap-0 overflow-hidden hover:border-primary/40 transition-colors"
            >
              <Link href={`/courses/${course.id}`} className="block">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / placeholder */}
                    <div className="hidden sm:block h-12 w-16 flex-shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                      {course.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {course.featured && (
                          <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                        )}
                        <Badge variant="outline" className="text-[9px] capitalize border-border/60">
                          {course.category.replace("-", " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] capitalize border-border/60">
                          {course.level}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1 leading-tight">
                        {course.name}
                      </h4>
                      {course.subtitle && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {course.subtitle}
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {course.durationWeeks}w
                        </span>
                        {course.rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-growth-amber" />
                            {course.rating.toFixed(1)}
                          </span>
                        )}
                        {course.enrollmentCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {course.enrollmentCount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {isFree ? (
                        <span className="text-sm font-semibold text-growth-sage">Free</span>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">
                          {formatPrice(course.price, course.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      <Button asChild variant="outline" className="w-full border-border">
        <Link href="/courses">
          Browse All Courses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
