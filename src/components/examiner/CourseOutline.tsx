"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BookOpen, ExternalLink, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Phase 2.3: CourseOutline — DB-driven view of the student's assigned course.
 *
 *  Replaces the old static `/course-plan.html` iframe (which was hardcoded
 *  for the 6-week web dev bootcamp and didn't reflect the student's actual
 *  course). Now fetches the full outline from /api/courses/user/outline and
 *  renders it natively, so a Python course shows Python topics, an HR course
 *  shows HR topics, etc.
 *
 *  Features:
 *  - Collapsible weeks (current week expanded by default)
 *  - Per-day: title, objective, whyItMatters, topicsCovered, activity,
 *    deliverable, resource links
 *  - Shows course metadata (domain, level, tools, deliverables) at the top
 *  - Falls back to a loading state, then an error state if the API fails
 */

interface CourseDay {
  day: number;
  title: string;
  objective: string;
  whyItMatters: string;
  topicsCovered: string[];
  activity: string;
  deliverable: string;
  resources: { label: string; url: string }[];
}
interface CourseWeek {
  week: number;
  phase: string;
  days: CourseDay[];
}
interface CourseOutlineData {
  courseName: string | null;
  courseDescription: string | null;
  domain: string | null;
  level: string | null;
  toolsUsed: string[];
  deliverableTypes: string[];
  totalWeeks: number;
  weeks: CourseWeek[];
}

export default function CourseOutline() {
  const [data, setData] = useState<CourseOutlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<CourseOutlineData>("/api/courses/user/outline")
      .then((res) => {
        setData(res);
        // Expand the first week by default so the student sees something
        if (res.weeks.length > 0) {
          setExpandedWeeks(new Set([res.weeks[0].week]));
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load course outline");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading course outline…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-foreground">Couldn&apos;t load your course outline.</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.weeks.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-foreground">No course outline available yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your course will appear here once it&apos;s set up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Course header */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
                {data.courseName || "Course Outline"}
              </CardTitle>
              {data.courseDescription && (
                <CardDescription className="text-muted-foreground mt-1">
                  {data.courseDescription}
                </CardDescription>
              )}
            </div>
            {/* LO-4 fix: removed stale "Classic HTML view" link — the DB-driven
                outline above is the primary view for all courses. The legacy
                /course-plan.html was a leftover from the pre-DB era. */}
          </div>
          {/* Course metadata badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {data.domain && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {data.domain}
              </Badge>
            )}
            {data.level && (
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                {data.level}
              </Badge>
            )}
            {data.toolsUsed.map((tool, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                {tool}
              </Badge>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Weeks */}
      <div className="space-y-2">
        {data.weeks.map((week) => {
          const isExpanded = expandedWeeks.has(week.week);
          return (
            <Card key={week.week} className="border-border bg-card overflow-hidden">
              {/* Week header — clickable to expand/collapse */}
              <button
                onClick={() => toggleWeek(week.week)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary flex-shrink-0">
                  Week {week.week}
                </Badge>
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {week.phase}
                </span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground flex-shrink-0">
                  {week.days.length} day{week.days.length === 1 ? "" : "s"}
                </Badge>
              </button>

              {/* Expanded content — the week's days */}
              {isExpanded && (
                <div className="border-t border-border p-3 space-y-2.5">
                  {week.days.map((day) => (
                    <div
                      key={day.day}
                      className="rounded-md border border-border bg-background/50 p-3 space-y-2"
                    >
                      {/* Day header */}
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[10px] text-cyan-600 border-cyan-500/30 flex-shrink-0 mt-0.5">
                          Day {day.day}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{day.title}</p>
                          {day.objective && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <strong className="text-foreground/70">Objective:</strong> {day.objective}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Why it matters */}
                      {day.whyItMatters && (
                        <p className="text-xs text-primary pl-7">
                          <strong>Why:</strong> {day.whyItMatters}
                        </p>
                      )}

                      {/* Topics covered */}
                      {day.topicsCovered.length > 0 && (
                        <div className="pl-7">
                          <p className="text-[10px] text-muted-foreground mb-1">Topics covered:</p>
                          <div className="flex flex-wrap gap-1">
                            {day.topicsCovered.map((topic, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] bg-muted text-muted-foreground">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Activity + Deliverable */}
                      {(day.activity || day.deliverable) && (
                        <div className="pl-7 space-y-1">
                          {day.activity && (
                            <p className="text-xs text-foreground/80">
                              <strong className="text-primary">Activity:</strong> {day.activity}
                            </p>
                          )}
                          {day.deliverable && (
                            <p className="text-xs text-foreground/80">
                              <strong className="text-foreground/70">Deliverable:</strong> {day.deliverable}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Resources */}
                      {day.resources.length > 0 && (
                        <div className="pl-7 space-y-1">
                          <p className="text-[10px] text-muted-foreground">Resources:</p>
                          {day.resources.map((r, i) => (
                            <a
                              key={i}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{r.label || r.url}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
