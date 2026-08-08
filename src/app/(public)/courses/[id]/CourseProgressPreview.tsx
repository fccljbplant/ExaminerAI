"use client";

/**
 * CourseProgressPreview — shown on the public course detail page
 * (/courses/[id]) ONLY for logged-in students who are enrolled in the course.
 *
 * Fetches its own progress data from /api/student/course-progress. If the
 * user is not logged in OR not enrolled, the component renders nothing
 * (so the public page stays clean for visitors).
 *
 * Renders:
 *   - A progress bar with percentage (X of Y weeks completed).
 *   - Week-by-week breakdown (each week with completion checkmark + score).
 *   - "Continue Learning" button → links to /app (the dashboard).
 *   - If certificate-eligible: a "Claim Your Certificate" CTA.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Circle, Award, ArrowRight, Trophy, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WeeklyBreakdownItem {
  week: number;
  completed: boolean;
  score: number | null;
}

interface CourseProgressResponse {
  courseId: string;
  courseName: string;
  totalWeeks: number;
  completedWeeks: number;
  completionPercent: number;
  avgScore: number;
  weeklyBreakdown: WeeklyBreakdownItem[];
  hasCertificate: boolean;
  certificateEligible: boolean;
}

export default function CourseProgressPreview({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CourseProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<CourseProgressResponse>(`/api/student/course-progress?courseId=${encodeURIComponent(courseId)}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 / 403 → user isn't logged in or isn't enrolled. Render nothing.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setHidden(true);
          return;
        }
        // Any other error — also hide (don't pollute the public page).
        setHidden(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  // Hide silently when the user isn't logged in / enrolled.
  if (loading || hidden || !data) return null;

  const pct = data.completionPercent;
  const isComplete = data.completedWeeks >= data.totalWeeks && data.totalWeeks > 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" /> Your progress
        </CardTitle>
        <CardDescription>
          {data.completedWeeks} of {data.totalWeeks} weeks completed · avg score {data.avgScore}/100
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Overall completion</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {/* Week-by-week breakdown */}
        <div className="space-y-1.5">
          {data.weeklyBreakdown.map((w) => (
            <div
              key={w.week}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {w.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-growth-sage flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">Week {w.week}</span>
                {w.completed && (
                  <Badge variant="secondary" className="text-[10px]">Done</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {w.score !== null ? (
                  <span className={cn("font-medium", scoreColor(w.score))}>
                    {w.score}/100
                  </span>
                ) : w.completed ? (
                  <span className="text-muted-foreground">Test pending</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 pt-1">
          {data.hasCertificate ? (
            <Button asChild size="sm" className="flex-1">
              <Link href="/app?view=credentials">
                <Trophy className="h-3.5 w-3.5" /> View your certificate
              </Link>
            </Button>
          ) : data.certificateEligible ? (
            <Button asChild size="sm" className="flex-1">
              <Link href="/app?view=credentials">
                <Award className="h-3.5 w-3.5" /> Claim your certificate
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="flex-1">
              <Link href="/app">
                {isComplete ? "Review Course" : "Continue Learning"}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </div>

        {!data.hasCertificate && !data.certificateEligible && (
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" />
            Complete all weeks with a 75+ average to earn your certificate
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Tailwind color class for a 0-100 score. */
function scoreColor(score: number): string {
  if (score >= 85) return "text-growth-sage";
  if (score >= 75) return "text-growth-sage";
  if (score >= 60) return "text-growth-amber";
  return "text-destructive";
}
