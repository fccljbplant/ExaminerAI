"use client";
// FILE: src/components/examiner/student/TodayView.tsx
// The modern trainee landing screen: "what do I do next?".
// Feed it from /api/today/summary.
// Replaces the wall of 26 panels as the trainee landing view.

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Flame, TrendingUp, TrendingDown, Minus,
  ClipboardList, Layers, GitBranch, FileQuestion, BookOpen,
  MessageSquare, AlertCircle, Loader2, LayoutGrid,
} from "lucide-react";
import OnboardingGuide from "./OnboardingGuide";
import StreakCalendar from "./StreakCalendar";
import DueTodayCard from "./DueTodayCard";
import { LearnerXPBar } from "@/components/shared/learner-xp-bar";

interface TodayData {
  traineeName: string;
  week: number;
  day: number;
  streakDays: number;
  learningSignal: {
    score: number;
    trend: "up" | "steady" | "down";
    tier: "green" | "amber" | "red";
    components: { name: string; value: number }[];
  } | null;
  nextAction: {
    kind: "daily-test" | "drill" | "project-task" | "weekly-test" | "lesson";
    title: string;
    meta: string;
  };
  dueDrills: number;
  mentorMessage?: { from: string; preview: string; unread: boolean } | null;
}

const TIER_STYLES = {
  green: { text: "text-growth-sage", border: "border-growth-sage", bg: "bg-growth-sage-soft", dot: "bg-growth-sage" },
  amber: { text: "text-growth-amber", border: "border-growth-amber", bg: "bg-growth-amber-soft", dot: "bg-growth-amber" },
  red:   { text: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/5", dot: "bg-rose-500" },
};

const ACTION_ICONS = {
  "daily-test": FileQuestion,
  "drill": Layers,
  "project-task": GitBranch,
  "weekly-test": ClipboardList,
  "lesson": BookOpen,
};

export default function TodayView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<TodayData>("/api/today/summary")
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <TodaySkeleton />;
  if (failed || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">Couldn't load today's plan.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const signal = data.learningSignal;
  const tier = signal?.tier ?? "amber";
  const tierStyle = TIER_STYLES[tier];
  const trendIcon = signal?.trend === "up" ? <TrendingUp className="h-4 w-4" />
    : signal?.trend === "down" ? <TrendingDown className="h-4 w-4" />
    : <Minus className="h-4 w-4" />;
  const ActionIcon = ACTION_ICONS[data.nextAction.kind] ?? BookOpen;

  const handleNextAction = () => {
    const kind = data.nextAction.kind;
    if (kind === "daily-test") onNavigate?.("study");
    else if (kind === "drill") onNavigate?.("study");
    else if (kind === "project-task") onNavigate?.("gantt");
    else if (kind === "weekly-test") onNavigate?.("study");
    else onNavigate?.("home");
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Onboarding guide — only renders for students who haven't
          completed all steps. Auto-hides once dismissed or finished. */}
      <OnboardingGuide onNavigate={onNavigate} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Today · Week {data.week}, Day {data.day}
          </h2>
          <p className="text-xs text-muted-foreground">Welcome back, {data.traineeName}.</p>
        </div>
        <div className="flex items-center gap-2">
          {data.streakDays > 0 && (
            <Badge variant="outline" className="gap-1.5 border-growth-amber bg-growth-amber-soft text-growth-amber">
              <Flame className="h-3.5 w-3.5" />
              {data.streakDays}-day streak
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => onNavigate?.("my-courses")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> My Courses
          </Button>
        </div>
      </div>

      {/* Next action — the answer to "what do I do now?" */}
      <button
        onClick={handleNextAction}
        className="w-full text-left rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10 hover:border-primary/60 group"
      >
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <ActionIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Do this next
            </p>
            <p className="mt-1 text-base font-bold text-foreground">{data.nextAction.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{data.nextAction.meta}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-3" />
        </div>
      </button>

      {/* Due today — inline card replacing the interrupting DailyTaskReminder
          popup. Surfaces ALL due items (not just the single most urgent) so
          the learner can pick what to work on. One tap → jump to the right
          view. Popups are now reserved for red-tier alerts only. */}
      <DueTodayCard onNavigate={(view) => onNavigate?.(view)} />

      {/* Evidence-Locked XP — only for learners. Casual-yet-professional:
          shows level + progress + the last few awards. NOT gamified-cheesy:
          no leaderboards, no badges-as-engagement-bait. XP is a trust
          signal (employer can see "this learner passed 20+ graded tests"). */}
      <LearnerXPBar />

      {/* Streak calendar — GitHub-style contribution grid showing the last
          12 weeks of study activity. Visible to any logged-in student. */}
      <StreakCalendar />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Transparent learning signal */}
        {signal && (
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your learning signal
                </p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tierStyle.border} ${tierStyle.bg} ${tierStyle.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tierStyle.dot}`} />
                  {signal.score}/100 {trendIcon}
                </span>
              </div>
              <div className="space-y-2.5">
                {signal.components.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{c.name}</span>
                      <span className="font-medium text-foreground">{c.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Computed only from scores, completion and activity — nothing hidden.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Drills + mentor */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-growth-amber-soft flex items-center justify-center flex-shrink-0">
                  <Layers className="h-5 w-5 text-growth-amber" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Mistake drills due
                  </p>
                  <p className="text-2xl font-bold text-foreground">{data.dueDrills}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Wrong answers come back until you own them.
              </p>
              {data.dueDrills > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full text-xs"
                  onClick={() => onNavigate?.("study")}
                >
                  Practice drills <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {data.mentorMessage && (
            <Card className="border-growth-amber bg-growth-amber-soft">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-growth-amber-soft flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-growth-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-growth-amber">
                      Mentor message {data.mentorMessage.unread && "· new"}
                    </p>
                    <p className="mt-1 text-xs text-foreground line-clamp-2">
                      "{data.mentorMessage.preview}"
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      from {data.mentorMessage.from}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-3 w-full text-xs"
                  onClick={() => onNavigate?.("messages")}
                >
                  Read message <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-4 max-w-4xl mx-auto animate-pulse">
      <div className="h-7 w-56 rounded-lg bg-muted" />
      <div className="h-24 rounded-xl bg-muted/60" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-44 rounded-xl bg-muted/60" />
        <div className="h-44 rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}
