"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Flame, Award, CalendarCheck, Activity } from "lucide-react";

/**
 * StreakCalendar — GitHub-style contribution grid for the student's daily
 * study activity.
 *
 * Fetches the last 12 weeks (84 days) of activity from
 * /api/student/streak-calendar and renders a 7×12 grid of small squares,
 * colored by activity level. Below the grid: stats (current streak, longest
 * streak, total active days, total activities).
 *
 * Compact design — fits in a Card, max ~400px wide.
 */

interface StreakDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3;
}
interface StreakData {
  days: StreakDay[];
  totalActiveDays: number;
  currentStreak: number;
  longestStreak: number;
  totalActivities: number;
}

const WEEKS = 12;
const DAYS_PER_WEEK = 7;

const LEVEL_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-muted",
  1: "bg-primary/30",
  2: "bg-primary/60",
  3: "bg-primary",
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function StreakCalendar() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<StreakData>("/api/student/streak-calendar")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-4 gap-2 mt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (failed || !data) {
    // Render nothing on failure — fail silently so it doesn't disrupt TodayView.
    return null;
  }

  // Build a 7×12 grid: rows = day-of-week (Sun..Sat), cols = weeks.
  // data.days is ordered oldest-first (84 entries).
  // The first day of the window may not be a Sunday — compute its weekday
  // offset and pad the front with nulls so the grid aligns to weeks.
  const grid: Array<(StreakDay | null)[]> = [];
  for (let w = 0; w < WEEKS; w++) {
    grid.push(Array.from({ length: DAYS_PER_WEEK }, () => null));
  }

  // Find the weekday of the first day so we can align it.
  if (data.days.length > 0) {
    const firstDate = new Date(data.days[0].date + "T00:00:00");
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat. We want Sun at row 0.
    const firstWeekday = firstDate.getDay();
    for (let i = 0; i < data.days.length; i++) {
      const totalIdx = firstWeekday + i;
      const week = Math.floor(totalIdx / DAYS_PER_WEEK);
      const dayOfWeek = totalIdx % DAYS_PER_WEEK;
      if (week < WEEKS) {
        grid[week][dayOfWeek] = data.days[i];
      }
    }
  }

  // Determine month labels per week (show only on weeks where the month changes).
  const monthLabels: string[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    // Find the first non-null day in this week to determine the month.
    const day = grid[w].find((d) => d !== null);
    if (day) {
      const d = new Date(day.date + "T00:00:00");
      const month = d.getMonth();
      if (month !== lastMonth) {
        monthLabels.push(MONTH_LABELS[month]);
        lastMonth = month;
      } else {
        monthLabels.push("");
      }
    } else {
      monthLabels.push("");
    }
  }

  const stats = [
    {
      icon: Flame,
      label: "Current",
      value: data.currentStreak,
      suffix: data.currentStreak === 1 ? " day" : " days",
      color: "text-amber-500",
    },
    {
      icon: Award,
      label: "Longest",
      value: data.longestStreak,
      suffix: data.longestStreak === 1 ? " day" : " days",
      color: "text-primary",
    },
    {
      icon: CalendarCheck,
      label: "Active days",
      value: data.totalActiveDays,
      suffix: "/ 84",
      color: "text-emerald-500",
    },
    {
      icon: Activity,
      label: "Activities",
      value: data.totalActivities,
      suffix: "",
      color: "text-blue-500",
    },
  ];

  return (
    <Card className="border-border max-w-[400px]">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-500" />
            Study activity
          </h3>
          {data.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              <Flame className="h-3 w-3" />
              {data.currentStreak}-day streak
            </span>
          )}
        </div>

        {/* Month labels */}
        <div className="flex gap-[3px] mb-1 pl-6">
          {monthLabels.map((m, i) => (
            <div
              key={i}
              className="h-3 text-[9px] text-muted-foreground flex items-center justify-center"
              style={{ width: 12 }}
            >
              {m}
            </div>
          ))}
        </div>

        {/* Grid: day labels + squares */}
        <div className="flex gap-1">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="h-3 text-[9px] text-muted-foreground flex items-center justify-end pr-1"
                style={{ width: 22 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Squares */}
          <TooltipProvider delayDuration={150}>
            <div className="flex gap-[3px]">
              {grid.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => (
                    <Tooltip key={dIdx}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-3 w-3 rounded-sm ${
                            day ? LEVEL_CLASS[day.level] : "bg-transparent"
                          } ${day && day.level > 0 ? "ring-1 ring-inset ring-black/5" : ""}`}
                        />
                      </TooltipTrigger>
                      {day && (
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-medium">
                            {formatDateLabel(day.date)}
                          </div>
                          <div className="text-muted-foreground">
                            {day.count === 0
                              ? "No activity"
                              : `${day.count} activit${day.count === 1 ? "y" : "ies"}`}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-muted-foreground">
          <span>Less</span>
          <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/60" />
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span>More</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-md bg-muted/40 p-2 text-center"
              >
                <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
                <div className="text-sm font-bold text-foreground leading-none">
                  {s.value}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-none">
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default StreakCalendar;
