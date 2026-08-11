"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { CheckCircle2, Circle, Lock, Loader2 } from "lucide-react";
import { WEEKLY_TOPICS } from "@/modules/course/lib/course-topics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface JourneyStep {
  id: string;
  stepOrder: number;
  stepType: string;
  title: string;
  description: string | null;
  status: "pending" | "active" | "completed";
  completedAt: string | null;
  metadata: { week: number; day: number } | null;
}

interface JourneyData {
  plan: { id: string; currentStep: number; totalSteps: number; status: string };
  steps: JourneyStep[];
  currentTopic: { week: number; day: number } | null;
}

interface Props {
  courseId: string;
  onClose: () => void;
}

/** Map of all 30 topics from WEEKLY_TOPICS keyed by `${week}-${day}`. */
function buildAllTopics() {
  const map = new Map<string, { week: number; day: number; title: string; phase: string }>();
  for (const w of WEEKLY_TOPICS) {
    w.topics.forEach((t, i) => {
      map.set(`${w.week}-${i + 1}`, { week: w.week, day: i + 1, title: t.title, phase: w.phase });
    });
  }
  return map;
}

export function JourneyPanel({ courseId, onClose }: Props) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const allTopics = buildAllTopics();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: JourneyData }>(`/api/learn/me/journey?courseId=${courseId}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) toast.error("Couldn't load your journey", { description: e instanceof Error ? e.message : undefined });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Couldn't load your journey.</div>;
  }

  const completedCount = data.steps.filter(s => s.status === "completed").length;
  const pct = data.plan.totalSteps > 0 ? Math.round((completedCount / data.plan.totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your journey</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} of {data.plan.totalSteps} topics complete · {pct}%
            </p>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {data.plan.status === "completed" ? "✅ Course complete" : "In progress"}
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {WEEKLY_TOPICS.map((week) => {
          const weekSteps = week.topics.map((t, idx) => {
            const stepOrder = (week.week - 1) * 5 + idx;
            const step = data.steps.find(s => s.stepOrder === stepOrder);
            return { topic: t, day: idx + 1, week: week.week, step };
          });
          const weekCompleted = weekSteps.filter(ws => ws.step?.status === "completed").length;
          return (
            <section key={week.week}>
              <header className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  Week {week.week} — <span className="text-muted-foreground font-normal">{week.phase}</span>
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {weekCompleted}/5 done
                </span>
              </header>
              <ol className="space-y-1.5">
                {weekSteps.map(({ topic, day, week: w, step }) => {
                  const status = step?.status ?? "pending";
                  const isCurrent = data.currentTopic?.week === w && data.currentTopic?.day === day;
                  return (
                    <li
                      key={`${w}-${day}`}
                      className={cn(
                        "flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        status === "active" && "bg-primary/10 ring-1 ring-primary/30",
                        status === "completed" && "hover:bg-muted/60 cursor-default",
                        status === "pending" && "opacity-60 cursor-not-allowed",
                      )}
                      title={status === "pending" ? "Complete earlier topics to unlock" : topic.title}
                    >
                      <span className="mt-0.5 flex-shrink-0">
                        {status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : status === "active" ? (
                          <Circle className="h-4 w-4 text-primary animate-pulse" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Day {day}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-medium text-primary">● Now</span>
                          )}
                        </div>
                        <p className="font-medium leading-snug truncate">{topic.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{topic.objective}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <footer className="px-5 py-3 border-t flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Tip: use the canvas to study today's topic, then come back to see your progress.
        </p>
        <button
          onClick={onClose}
          className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-muted"
        >
          Close
        </button>
      </footer>
    </div>
  );
}
