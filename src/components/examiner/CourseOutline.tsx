"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import {
  BookOpen, ExternalLink, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, Circle, PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SlideViewer, { type SlideViewerCourseDay } from "@/components/examiner/student/SlideViewer";
import AIPanel, { type AIMessage } from "@/components/examiner/student/AIPanel";

/** Phase 2.3 → Phase 3: CourseOutline — DB-driven view of the student's assigned course.
 *
 *  PHASE 3 UPDATE: now drives a SlideViewer + AIPanel layout instead of the
 *  flat list of day cards. Each day in the week accordion is a clickable
 *  row; clicking it loads that day into the SlideViewer. The AIPanel on
 *  the right carries the conversation across slides.
 *
 *  Features:
 *  - Collapsible weeks (current week expanded by default)
 *  - Clickable day rows that load the SlideViewer
 *  - SlideViewer generates slides on-the-fly from CourseDay fields
 *    (video, concept, code examples, web images, activity, reflection)
 *  - AIPanel on the right with persistent conversation thread
 *  - Falls back to a loading state, then an error state if the API fails
 */

interface CourseDay extends SlideViewerCourseDay {}
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

interface SelectedDayRef {
  week: number;
  day: number;
}

export default function CourseOutline() {
  const [data, setData] = useState<CourseOutlineData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<SelectedDayRef | null>(null);

  // AIPanel state — conversation thread persists across slides
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [bubbleContent, setBubbleContent] = useState<string | null>(null);
  const [currentSlideLabel, setCurrentSlideLabel] = useState<string>("this slide");

  useEffect(() => {
    Promise.all([
      api.get<CourseOutlineData>("/api/courses/user/outline"),
      api.get<{ user: { currentWeek: number } | null }>("/api/auth/me").catch(() => ({ user: null })),
    ]).then(([res, meRes]) => {
      setData(res);
      const userWeek = meRes.user?.currentWeek ?? 1;
      setCurrentWeek(userWeek);
      // Expand the CURRENT week by default and auto-select Day 1 of it.
      const weeksToExpand = new Set<number>();
      if (res.weeks.length > 0) {
        const currentWeekData = res.weeks.find(w => w.week === userWeek);
        if (currentWeekData) {
          weeksToExpand.add(currentWeekData.week);
          // Auto-select the first day of the current week for the SlideViewer
          if (currentWeekData.days.length > 0) {
            setSelected({ week: currentWeekData.week, day: currentWeekData.days[0].day });
          }
        } else {
          // User's currentWeek is beyond the course length — expand the last week
          const lastWeek = res.weeks[res.weeks.length - 1];
          weeksToExpand.add(lastWeek.week);
          if (lastWeek.days.length > 0) {
            setSelected({ week: lastWeek.week, day: lastWeek.days[0].day });
          }
        }
      }
      setExpandedWeeks(weeksToExpand);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load course outline");
    }).finally(() => setLoading(false));
  }, []);

  const toggleWeek = (week: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  // Find the currently-selected CourseDay object (if any)
  const selectedDay = useMemo<CourseDay | null>(() => {
    if (!data || !selected) return null;
    const week = data.weeks.find(w => w.week === selected.week);
    if (!week) return null;
    return week.days.find(d => d.day === selected.day) ?? null;
  }, [data, selected]);

  const selectedWeekPhase = useMemo<string | undefined>(() => {
    if (!data || !selected) return undefined;
    return data.weeks.find(w => w.week === selected.week)?.phase;
  }, [data, selected]);

  // AIPanel handlers — wired to real /api/ai/tutor
  const [aiLoading, setAiLoading] = useState(false);
  const handleSend = async (text: string) => {
    const slideNum = aiMessages.length > 0
      ? aiMessages[aiMessages.length - 1].slideNum
      : undefined;
    setAiMessages(prev => [
      ...prev,
      { role: "user", content: text, slideNum },
    ]);
    setAiLoading(true);
    try {
      // Build messages array for the API (expects { messages: [{role, content}] })
      const allMessages = [
        ...aiMessages.map(m => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const res = await api.post<{ reply: string }>("/api/ai/tutor", {
        messages: allMessages,
      }, AI_TIMEOUT_MS);
      setAiMessages(prev => [
        ...prev,
        { role: "assistant", content: res.reply || "I'm having trouble responding right now. Please try again.", slideNum },
      ]);
    } catch {
      setAiMessages(prev => [
        ...prev,
        { role: "assistant", content: "I'm having trouble responding right now. Please try again in a moment.", slideNum },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    const labelMap: Record<string, string> = {
      "explain-differently": "Can you explain this slide differently?",
      "give-example": "Give me a concrete example of this concept.",
      "stuck": "I'm stuck on this part — walk me through it step by step.",
    };
    const msg = labelMap[action] || action;
    handleSend(msg);
  };

  // Proactive bubble — pop one when the slide changes (debounced + dismissible)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedDay) return;
    setBubbleContent(null);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => {
      setBubbleContent(
        `Heads up on "${currentSlideLabel}" — pause and ask if anything feels fuzzy. I'm here.`
      );
    }, 2500);
    return () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    };
  }, [currentSlideLabel, selectedDay]);

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
    <div className="space-y-4">
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

      {/* Weeks accordion — day rows now load the SlideViewer on click */}
      <div className="space-y-2">
        {data.weeks.map((week) => {
          const isExpanded = expandedWeeks.has(week.week);
          const isCurrentWeek = week.week === currentWeek;
          return (
            <Card
              key={week.week}
              className={cn(
                "bg-card overflow-hidden transition-colors",
                isCurrentWeek
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : "border-border"
              )}
            >
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
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] flex-shrink-0",
                    isCurrentWeek
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/30 text-primary"
                  )}
                >
                  Week {week.week}
                </Badge>
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {week.phase}
                </span>
                {isCurrentWeek && (
                  <Badge className="text-[9px] bg-primary text-primary-foreground flex-shrink-0">
                    You are here
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] text-muted-foreground flex-shrink-0">
                  {week.days.length} day{week.days.length === 1 ? "" : "s"}
                </Badge>
              </button>

              {/* Expanded content — clickable day rows */}
              {isExpanded && (
                <div className="border-t border-border p-2 space-y-1">
                  {week.days.map((day) => {
                    const isSelected =
                      selected?.week === week.week && selected?.day === day.day;
                    const hasVideo = !!day.videoUrl;
                    const hasCode = day.codeExamples.length > 0;
                    const hasImages = day.webImages.length > 0;
                    return (
                      <button
                        key={day.day}
                        onClick={() => setSelected({ week: week.week, day: day.day })}
                        className={cn(
                          "w-full text-left rounded-md border p-2.5 transition-colors flex items-start gap-2.5",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border bg-background/50 hover:bg-muted/40 hover:border-primary/30"
                        )}
                      >
                        {/* Status icon — done (if past) / active (selected) / upcoming */}
                        {isSelected ? (
                          <PlayCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] text-cyan-600 border-cyan-500/30 flex-shrink-0"
                            >
                              Day {day.day}
                            </Badge>
                            <p className="text-sm font-medium text-foreground truncate">
                              {day.title}
                            </p>
                          </div>
                          {day.objective && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {day.objective}
                            </p>
                          )}
                          {/* Slide hints — show what kind of content this day has */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {hasVideo && (
                              <Badge variant="secondary" className="text-[9px] bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20">
                                <PlayCircle className="h-2.5 w-2.5" /> Video
                              </Badge>
                            )}
                            {hasCode && (
                              <Badge variant="secondary" className="text-[9px] bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20">
                                {day.codeExamples.length} code
                              </Badge>
                            )}
                            {hasImages && (
                              <Badge variant="secondary" className="text-[9px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                                {day.webImages.length} visual
                              </Badge>
                            )}
                            {day.topicsCovered.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] bg-muted text-muted-foreground">
                                {day.topicsCovered.length} topics
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* SlideViewer + AIPanel — shown once a day is selected */}
      {selectedDay ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
          {/* SlideViewer — left column */}
          <div className="min-w-0">
            <SlideViewer
              courseDay={selectedDay}
              weekNumber={selected?.week}
              weekPhase={selectedWeekPhase}
              onSlideChange={(label) => setCurrentSlideLabel(label)}
            />
          </div>
          {/* AIPanel — right column (sticky on desktop) */}
          <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)]">
            <AIPanel
              currentSlideLabel={currentSlideLabel}
              messages={aiMessages}
              onSend={handleSend}
              onQuickAction={handleQuickAction}
              bubbleContent={bubbleContent}
              onBubbleDismiss={() => setBubbleContent(null)}
            />
          </div>
        </div>
      ) : (
        <Card className="border-border bg-card border-dashed">
          <CardContent className="p-6 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-foreground">Pick a day above to start learning.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Each day is rendered as a sequence of slides — video, concept, code, visual, activity, and reflection.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
