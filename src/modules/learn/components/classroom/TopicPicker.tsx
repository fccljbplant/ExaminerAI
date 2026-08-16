"use client";

// src/modules/learn/components/classroom/TopicPicker.tsx — course topic map + re-learn.
// Lists every topic of the course (outline-first) with completed/current/
// locked status. Completed topics can be re-learned; locked topics
// unlock as the learner advances.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Lock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicDay {
  day: number;
  title: string;
  objective: string;
  status: "completed" | "current" | "unlocked" | "locked";
}

interface TopicsData {
  weeks: { week: number; phase: string; days: TopicDay[] }[];
  current: { week: number; day: number } | null;
  courseCompleted: boolean;
}

interface Props {
  courseId: string;
  onJump: (week: number, day: number) => void;
}

export function TopicPicker({ courseId, onJump }: Props) {
  const [data, setData] = useState<TopicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: TopicsData }>(`/api/learn/topics?courseId=${courseId}`);
      setData(res.data);
    } catch (e) {
      toast.error("Couldn't load topics", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function jump(week: number, day: number) {
    const key = `${week}-${day}`;
    setBusyKey(key);
    try {
      await api.post(`/api/learn/topics/jump?courseId=${courseId}`, { week, day });
      toast.success(`Jumped to Week ${week} · Day ${day}`);
      onJump(week, day);
    } catch (e) {
      toast.error("Couldn't open that topic", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto p-3">
      {data.weeks.map((w) => (
        <section key={w.week} className="mb-3">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
            Week {w.week} · {w.phase}
          </p>
          <div className="mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {w.days.map((d) => {
              const key = `${w.week}-${d.day}`;
              const locked = d.status === "locked";
              const current = d.status === "current";
              const done = d.status === "completed";
              const unlocked = d.status === "unlocked";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !locked && void jump(w.week, d.day)}
                  disabled={locked || busyKey === key}
                  className={cn(
                    "flex w-full min-h-11 items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    locked ? "cursor-not-allowed opacity-50" : "hover:bg-bg-subtle/60",
                    current && "bg-brand-subtle/50",
                  )}
                >
                  <span className="shrink-0">
                    {busyKey === key ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
                    ) : done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                    ) : current ? (
                      <Radio className="h-4 w-4 text-brand" aria-hidden />
                    ) : unlocked ? (
                      <Circle className="h-4 w-4 text-fg-muted" aria-hidden />
                    ) : (
                      <Lock className="h-4 w-4 text-fg-muted" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      <span className="mr-1.5 text-[10px] font-semibold text-fg-muted">D{d.day}</span>
                      {d.title}
                    </span>
                    <span className="block truncate text-[11px] text-fg-muted">{d.objective}</span>
                  </span>
                  {done && !current && (
                    <span className="shrink-0 text-[10px] font-medium text-fg-muted">re-learn</span>
                  )}
                  {unlocked && (
                    <span className="shrink-0 text-[10px] font-medium text-fg-muted">resume</span>
                  )}
                  {current && (
                    <span className="shrink-0 text-[10px] font-semibold text-brand">now</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="px-1 pb-2 text-[10px] leading-relaxed text-fg-muted">
        Completed topics can be re-learned any time — your progress and XP stay intact.
      </p>
    </div>
  );
}
