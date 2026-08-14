"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { ChevronDown, ChevronUp, Play, Code2, BookOpen } from "lucide-react";
import { Badge } from "@/modules/ui/badge";
import { Button } from "@/modules/ui/button";

interface PreviewData {
  courseName: string;
  weekNumber: number;
  weekPhase: string;
  day: {
    day: number;
    title: string;
    objective: string;
    whyItMatters: string;
    topicsCovered: string[];
    videoUrl: string | null;
    codeExamples: { filename: string; language: string; code: string }[];
  };
  totalWeeks: number;
  totalDays: number;
}

export default function CoursePreviewSection({ courseId }: { courseId: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PreviewData>(`/api/marketplace/courses/${courseId}/preview`)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading || !preview) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Preview First Lesson</h3>
              <p className="text-xs text-muted-foreground">
                Week {preview.weekNumber}, Day {preview.day.day}: {preview.day.title}
              </p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-4 border-t border-primary/20">
            <div>
              <p className="text-sm font-medium text-foreground mt-3">Learning Objective</p>
              <p className="text-sm text-muted-foreground mt-1">{preview.day.objective}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Why It Matters</p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{preview.day.whyItMatters}</p>
            </div>
            {preview.day.topicsCovered.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {preview.day.topicsCovered.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            )}
            {preview.day.videoUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <iframe
                  src={preview.day.videoUrl}
                  className="w-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {preview.day.codeExamples.length > 0 && (
              <div className="rounded-lg bg-zinc-950 border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs font-mono text-muted-foreground">{preview.day.codeExamples[0].filename}</span>
                </div>
                <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                  {preview.day.codeExamples[0].code.slice(0, 500)}
                  {preview.day.codeExamples[0].code.length > 500 && "\n..."}
                </pre>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground">
                Like what you see? Enroll to access all {preview.totalDays} lessons across {preview.totalWeeks} weeks.
              </p>
              <Button asChild size="sm">
                <a href="#enroll">Enroll Now</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
