"use client";

/**
 * SlideViewer — Phase 3 of the TraineesAI modernization.
 *
 * A pure render function that takes a CourseDay and generates slides
 * on-the-fly. There is NO Slide DB table — slides are derived from
 * which fields are populated on the day:
 *
 *   1. videoUrl                       → Video slide (embedded YouTube iframe)
 *   2. objective + whyItMatters       → Concept slide (text + "Why this matters" callout)
 *   3. codeExamples[]                 → One Code slide per example (filename header + code block)
 *   4. webImages[]                    → One Visual slide per image (image + caption + source link)
 *   5. activity + deliverable         → Activity slide (capstone work card)
 *   6. reflection (auto-generated)    → Reflection slide (3 questions from objective if empty)
 *
 * Layout:
 *   - Topic strip: "Week {n} · {weekPhase} > Day {n} — {title}"
 *   - Horizontal flow strip: clickable chips for each slide (✓ done → active → upcoming)
 *   - Slide viewport: centered, max-width 680px
 *   - Prev/Next nav at bottom with keyboard ← → support (skips when typing in inputs)
 *   - Each slide has a badge: "Slide 3 of 6 · Code"
 *
 * Self-contained — no API calls, no DB writes, no new deps.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, PlayCircle, Code2, Image as ImageIcon,
  Target, Lightbulb, CheckCircle2, ExternalLink, Activity,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface SlideViewerCourseDay {
  day: number;
  title: string;
  objective: string;
  whyItMatters: string;
  topicsCovered: string[];
  /** NOTE: steps doesn't exist on CourseDay — falls back to topicsCovered */
  steps?: string[];
  activity: string;
  deliverable: string;
  /** NOTE: githubCommit doesn't exist on CourseDay — skipped */
  githubCommit?: string;
  /** NOTE: reflection doesn't exist on CourseDay — auto-generated from objective */
  reflection?: string[];
  resources: { label: string; url: string }[];
  videoUrl: string | null;
  videoTitle: string | null;
  codeExamples: { filename: string; language: string; code: string; explanation: string }[];
  webImages: { url: string; caption: string; source: string }[];
}

interface SlideViewerProps {
  courseDay: SlideViewerCourseDay;
  weekPhase?: string;
  weekNumber?: number;
  /** Called when the active slide changes — used by parent to drive the AIPanel */
  onSlideChange?: (slideLabel: string, slideNum: number, total: number) => void;
}

type SlideType = "video" | "concept" | "code" | "visual" | "activity" | "reflection";

interface Slide {
  id: string;
  type: SlideType;
  /** Short label shown in the chip strip + badge, e.g. "Code · makeCounter walkthrough" */
  label: string;
  /** One-word category shown in the badge, e.g. "Code" */
  category: string;
  render: () => React.ReactNode;
}

// ============================================================
// Helpers
// ============================================================

/** Generate 3 reflection questions from the day's objective. */
function generateReflectionQuestions(objective: string): string[] {
  const base = objective.trim() || "today's lesson";
  // Pull the verb / subject out of the objective for more natural questions.
  // Example: "Build a counter component" → "counter component"
  const lower = base.toLowerCase();
  const cleaned = lower
    .replace(/^(build|create|make|implement|design|write|understand|learn|practice|explore|use|setup|set up|configure)\s+/i, "")
    .trim() || base;
  return [
    `What was the most confusing part of ${cleaned}?`,
    `How would you explain ${cleaned} to a junior teammate in one sentence?`,
    `Where in your capstone project could you apply ${cleaned} this week?`,
  ];
}

/** True when the user is typing in a text input/textarea/contenteditable. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

// ============================================================
// Slide content components (kept inline to keep this self-contained)
// ============================================================

function VideoSlide({ videoUrl, videoTitle }: { videoUrl: string; videoTitle: string | null }) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-base text-foreground">
            {videoTitle || "Watch this"}
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          A short video walkthrough of today&rsquo;s concept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-background" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={videoUrl}
            title={videoTitle || "Lesson video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ConceptSlide({
  title, objective, whyItMatters, topicsCovered,
}: {
  title: string; objective: string; whyItMatters: string; topicsCovered: string[];
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {objective ? (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Objective</p>
            <p className="text-sm text-foreground leading-relaxed">{objective}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No objective set for this day yet.
          </p>
        )}

        {whyItMatters && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                Why this matters
              </span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{whyItMatters}</p>
          </div>
        )}

        {topicsCovered.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Topics covered
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topicsCovered.map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CodeSlide({
  example,
}: {
  example: { filename: string; language: string; code: string; explanation: string };
}) {
  const lines = example.code.split("\n");
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Code2 className="h-4 w-4 text-primary flex-shrink-0" />
            <CardTitle className="text-sm font-mono text-foreground truncate">
              {example.filename}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary flex-shrink-0">
            {example.language}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border bg-background/80 overflow-hidden">
          {/* Filename header strip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/40">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-growth-amber/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-growth-sage/60" />
            <span className="ml-2 text-[10px] font-mono text-muted-foreground truncate">
              {example.filename}
            </span>
          </div>
          {/* Code block — basic monospace styling (no new deps for syntax highlighting) */}
          <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
            <code className="font-mono text-foreground/90">
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none w-7 flex-shrink-0 text-right pr-3 text-muted-foreground/40">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
        {example.explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {example.explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VisualSlide({
  image,
}: {
  image: { url: string; caption: string; source: string };
}) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
          <CardTitle className="text-sm text-foreground">Visual reference</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
          { }
          <img
            src={image.url}
            alt={image.caption}
            className="w-full max-h-[420px] object-contain bg-background"
            loading="lazy"
          />
        </div>
        {image.caption && (
          <p className="text-sm text-foreground/90 leading-relaxed">{image.caption}</p>
        )}
        {image.source && (
          <a
            href={image.source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{image.source}</span>
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitySlide({
  activity, deliverable, steps, resources,
}: {
  activity: string;
  deliverable: string;
  steps: string[];
  resources: { label: string; url: string }[];
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-base text-foreground">Today&rsquo;s capstone work</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activity && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
              Activity
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{activity}</p>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Suggested steps
            </p>
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="flex-shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {deliverable && (
          <div className="rounded-lg border border-growth-sage bg-growth-sage-soft p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-growth-sage" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-growth-sage dark:text-growth-sage">
                Deliverable
              </span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{deliverable}</p>
          </div>
        )}

        {resources.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Resources
            </p>
            <div className="space-y-1">
              {resources.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{r.label || r.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReflectionSlide({ questions }: { questions: string[] }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
          <CardTitle className="text-base text-foreground">Reflect on today</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          Take 2 minutes to think these through — they lock the learning in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-border bg-background/50 p-3"
            >
              <span className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-foreground/90 leading-relaxed">{q}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main SlideViewer
// ============================================================

export default function SlideViewer({
  courseDay, weekPhase, weekNumber, onSlideChange,
}: SlideViewerProps) {
  // Build the slide list deterministically from the CourseDay fields.
  const slides: Slide[] = useMemo(() => {
    const out: Slide[] = [];

    // 1. Video slide (only if videoUrl is set)
    if (courseDay.videoUrl) {
      const title = courseDay.videoTitle || "Lesson video";
      out.push({
        id: "video",
        type: "video",
        label: `Video · ${title}`,
        category: "Video",
        render: () => (
          <VideoSlide videoUrl={courseDay.videoUrl!} videoTitle={courseDay.videoTitle} />
        ),
      });
    }

    // 2. Concept slide — only if there's an objective or whyItMatters
    if (courseDay.objective || courseDay.whyItMatters) {
      out.push({
        id: "concept",
        type: "concept",
        label: `Concept · ${courseDay.title}`,
        category: "Concept",
        render: () => (
          <ConceptSlide
            title={courseDay.title}
            objective={courseDay.objective}
            whyItMatters={courseDay.whyItMatters}
            topicsCovered={courseDay.topicsCovered}
          />
        ),
      });
    }

    // 3. One Code slide per example
    courseDay.codeExamples.forEach((ex, idx) => {
      out.push({
        id: `code-${idx}`,
        type: "code",
        label: `Code · ${ex.filename}`,
        category: "Code",
        render: () => <CodeSlide example={ex} />,
      });
    });

    // 4. One Visual slide per web image
    courseDay.webImages.forEach((img, idx) => {
      out.push({
        id: `visual-${idx}`,
        type: "visual",
        label: `Visual · ${img.caption || "reference"}`,
        category: "Visual",
        render: () => <VisualSlide image={img} />,
      });
    });

    // 5. Activity slide — only if there's an activity or deliverable
    if (courseDay.activity || courseDay.deliverable) {
      out.push({
        id: "activity",
        type: "activity",
        label: "Activity · capstone work",
        category: "Activity",
        render: () => (
          <ActivitySlide
            activity={courseDay.activity}
            deliverable={courseDay.deliverable}
            steps={courseDay.steps ?? courseDay.topicsCovered}
            resources={courseDay.resources}
          />
        ),
      });
    }

    // 6. Reflection slide (always last — auto-generated from objective if empty)
    const reflectionQuestions =
      courseDay.reflection && courseDay.reflection.length > 0
        ? courseDay.reflection
        : generateReflectionQuestions(courseDay.objective);
    out.push({
      id: "reflection",
      type: "reflection",
      label: "Reflection · 3 questions",
      category: "Reflection",
      render: () => <ReflectionSlide questions={reflectionQuestions} />,
    });

    return out;
  }, [courseDay]);

  const total = slides.length;
  const [activeIdx, setActiveIdx] = useState(0);

  // Clamp activeIdx when the day changes (total may shrink)
  useEffect(() => {
    if (activeIdx >= total) setActiveIdx(Math.max(0, total - 1));
  }, [activeIdx, total]);

  // Notify parent of slide changes (for AIPanel binding)
  useEffect(() => {
    if (!onSlideChange) return;
    const slide = slides[activeIdx];
    if (slide) onSlideChange(slide.label, activeIdx + 1, total);
     
  }, [activeIdx, total]);

  const goTo = useCallback(
    (next: number) => {
      setActiveIdx((prev) => Math.max(0, Math.min(total - 1, next)));
    },
    [total]
  );

  const goPrev = useCallback(() => goTo(activeIdx - 1), [activeIdx, goTo]);
  const goNext = useCallback(() => goTo(activeIdx + 1), [activeIdx, goTo]);

  // Keyboard navigation — ArrowLeft / ArrowRight. Skip when typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  if (total === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-foreground">No slides available for this day.</p>
          <p className="text-xs text-muted-foreground mt-1">
            The course author hasn&rsquo;t added any content yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = slides[activeIdx];

  return (
    <div className="space-y-4">
      {/* Topic strip — breadcrumb */}
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
        {weekNumber != null && (
          <>
            <span className="font-medium text-foreground/80">Week {weekNumber}</span>
            {weekPhase && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{weekPhase}</span>
              </>
            )}
            <span className="text-muted-foreground/50">&gt;</span>
          </>
        )}
        <span className="font-medium text-foreground/80">Day {courseDay.day}</span>
        <span className="text-muted-foreground/50">—</span>
        <span className="text-foreground">{courseDay.title}</span>
      </div>

      {/* Horizontal flow strip — slide chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {slides.map((slide, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <button
              key={slide.id}
              onClick={() => goTo(i)}
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : isDone
                    ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-current={isActive ? "step" : undefined}
              title={slide.label}
            >
              <SlideTypeIcon type={slide.type} className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{slide.category}</span>
              {isDone && <CheckCircle2 className="h-3 w-3 flex-shrink-0 opacity-80" />}
            </button>
          );
        })}
      </div>

      {/* Slide viewport */}
      <div className="mx-auto w-full" style={{ maxWidth: "680px" }}>
        {/* Slide badge */}
        <div className="flex items-center justify-between mb-2 px-1">
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Slide {activeIdx + 1} of {total} · {active.category}
          </Badge>
          <span className="text-[10px] text-muted-foreground/70">
            Use ← → to navigate
          </span>
        </div>

        {/* Active slide content */}
        <div key={active.id} className="animate-in fade-in-50 duration-200">
          {active.render()}
        </div>

        {/* Prev / Next nav */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={activeIdx === 0}
            className="border-border"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {activeIdx + 1} / {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={activeIdx === total - 1}
            className="border-border"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small icon picker for the slide chips. */
function SlideTypeIcon({ type, className }: { type: SlideType; className?: string }) {
  switch (type) {
    case "video":      return <PlayCircle className={className} />;
    case "concept":    return <Target className={className} />;
    case "code":       return <Code2 className={className} />;
    case "visual":     return <ImageIcon className={className} />;
    case "activity":   return <Activity className={className} />;
    case "reflection": return <Lightbulb className={className} />;
  }
}
