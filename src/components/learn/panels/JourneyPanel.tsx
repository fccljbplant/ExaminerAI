"use client";

// src/components/learn/panels/JourneyPanel.tsx — course topic map (v2).
// Outline-first journey map: the COURSE'S OWN weeks/days (CourseWeek/
// CourseDay) with per-topic status. Completed topics can be re-learned
// by tapping; the current topic is highlighted; locked ones unlock as
// the learner advances. Courses without outline rows fall back to the
// legacy 6×5 ladder server-side.

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { CheckCircle2, Circle, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TopicDay {
  day: number;
  title: string;
  objective: string;
  status: "completed" | "current" | "locked";
}

interface JourneyData {
  weeks: { week: number; phase: string; days: TopicDay[] }[];
  current: { week: number; day: number } | null;
  courseCompleted: boolean;
}

interface Props {
  courseId: string;
  onClose: () => void;
  onJump?: (week: number, day: number) => void;
}

export function JourneyPanel({ courseId, onClose, onJump }: Props) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: JourneyData }>(`/api/learn/topics?courseId=${courseId}`);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) {
          toast.error("Couldn't load your journey", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function jump(week: number, day: number) {
    const key = `${week}-${day}`;
    setBusyKey(key);
    try {
      await api.post(`/api/learn/topics/jump?courseId=${courseId}`, { week, day });
      onJump?.(week, day);
    } catch (e) {
      toast.error("Couldn't open that topic", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">Couldn&apos;t load your journey.</div>;
  }

  const totalDays = data.weeks.reduce((s, w) => s + w.days.length, 0);
  const completedCount = data.weeks.reduce(
    (s, w) => s + w.days.filter((d) => d.status === "completed").length,
    0,
  );
  const pct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your journey</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completedCount} of {totalDays} topics complete · {pct}%
            </p>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {data.courseCompleted ? "✅ Course complete" : "In progress"}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {data.weeks.map((week) => {
          const weekCompleted = week.days.filter((d) => d.status === "completed").length;
          return (
            <section key={week.week}>
              <header className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">
                  Week {week.week} — <span className="font-normal text-muted-foreground">{week.phase}</span>
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {weekCompleted}/{week.days.length} done
                </span>
              </header>
              <ol className="space-y-1.5">
                {week.days.map((d) => {
                  const key = `${week.week}-${d.day}`;
                  const isCurrent = d.status === "current";
                  const isCompleted = d.status === "completed";
                  const locked = d.status === "locked";
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => !locked && void jump(week.week, d.day)}
                        disabled={locked || busyKey === key}
                        className={cn(
                          "flex min-h-11 w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                          isCurrent && "bg-primary/10 ring-1 ring-primary/30",
                          isCompleted && "hover:bg-muted/60",
                          locked && "cursor-not-allowed opacity-60",
                        )}
                        title={locked ? "Complete earlier topics to unlock" : isCompleted ? "Re-learn this topic" : d.title}
                      >
                        <span className="mt-0.5 flex-shrink-0">
                          {busyKey === key ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-growth-sage" />
                          ) : isCurrent ? (
                            <Circle className="h-4 w-4 animate-pulse text-primary" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground/60" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Day {d.day}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-medium text-primary">● Now</span>
                            )}
                            {isCompleted && !isCurrent && (
                              <span className="text-[10px] font-medium text-muted-foreground">· re-learn</span>
                            )}
                          </div>
                          <p className="truncate font-medium leading-snug">{d.title}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{d.objective}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <footer className="flex items-center justify-between border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Tap any completed topic to learn it again — progress and XP stay intact.
        </p>
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-muted">
          Close
        </button>
      </footer>
    </div>
  );
}
