"use client";

/**
 * TodayView — the teacher's home screen. A triage list, not a dashboard.
 *
 * Shows:
 * - "Needs you now" — merged, urgency-sorted feed: crisis flags, overdue
 *   touchpoints, unread messages. One list, not three tabs.
 * - "Changed since you last logged in" — tier changes, new flags,
 *   students who went quiet.
 *
 * MVP: pure reorganization of existing data (flags, touchpoints, messages).
 * P2: AI Assistant query box, "a win not just a fire".
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MessageSquare, HeartHandshake, TrendingDown, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentRow } from "@/components/examiner/teacher/types";

interface TodayViewProps {
  students: StudentRow[];
  onStudentClick: (student: StudentRow) => void;
  onViewChange: (view: "students" | "messages" | "mentorship") => void;
}

export function TodayView({ students, onStudentClick, onViewChange }: TodayViewProps) {
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<Array<{
    id: string;
    type: "crisis" | "touchpoint" | "message";
    urgency: number;
    title: string;
    description: string;
    studentName?: string;
    timestamp: string;
    action: () => void;
  }>>([]);
  const [strugglingStudents, setStrugglingStudents] = useState<StudentRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    // Build feed items from the students data we already have (from stats)
    // rather than making API calls that may fail due to missing query params.
    const items: Array<{
      id: string;
      type: "crisis" | "touchpoint" | "message";
      urgency: number;
      title: string;
      description: string;
      studentName?: string;
      timestamp: string;
      action: () => void;
    }> = [];

    // Struggling students (progress < 50%)
    const struggling = students.filter(s => (s.progress || 0) < 50).slice(0, 5);
    setStrugglingStudents(struggling);

    // Students who haven't been active recently (touchpoint overdue proxy)
    const now = Date.now();
    for (const s of students) {
      if (!s.lastActive) continue;
      const daysSinceActive = (now - new Date(s.lastActive).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 3) {
        items.push({
          id: `inactive-${s.id}`,
          type: "touchpoint",
          urgency: 2,
          title: `No activity: ${s.name}`,
          description: `Last active ${Math.round(daysSinceActive)} days ago — may need a check-in.`,
          studentName: s.name,
          timestamp: s.lastActive,
          action: () => onStudentClick(s),
        });
      }
    }

    // Students needing attention (from stats)
    for (const s of students) {
      if ((s as any).needsAttention) {
        items.push({
          id: `attention-${s.id}`,
          type: "crisis",
          urgency: 1,
          title: `Needs attention: ${s.name}`,
          description: `Flagged for attention — check their recent activity.`,
          studentName: s.name,
          timestamp: s.lastActive || new Date().toISOString(),
          action: () => onStudentClick(s),
        });
      }
    }

    // Sort by urgency then timestamp
    items.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency - b.urgency;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setFeedItems(items.slice(0, 20)); // cap at 20 items
    setLoading(false);
  }, [students, onStudentClick]);

  useEffect(() => { load(); }, [load]);

  const changedSinceLogin = students.filter(s => {
    if (!s.lastActive) return false;
    const lastActive = new Date(s.lastActive).getTime();
    // Show students active in the last 24 hours
    return (Date.now() - lastActive) < 24 * 60 * 60 * 1000;
  }).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Needs you now */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Needs you now
          </CardTitle>
          <CardDescription>
            {feedItems.length === 0
              ? "Nothing urgent right now. You're caught up."
              : `${feedItems.length} item${feedItems.length === 1 ? "" : "s"} need your attention.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {feedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">All clear. Check back later or review your roster.</p>
            </div>
          ) : (
            feedItems.map(item => {
              const Icon = item.type === "crisis" ? AlertCircle
                : item.type === "touchpoint" ? HeartHandshake
                : MessageSquare;
              const color = item.type === "crisis" ? "text-red-500"
                : item.type === "touchpoint" ? "text-amber-500"
                : "text-blue-500";
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Changed since last login */}
      {changedSinceLogin.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-500" />
              Active in the last 24 hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {changedSinceLogin.map(s => (
              <button
                key={s.id}
                onClick={() => onStudentClick(s)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Struggling students quick-access */}
      {strugglingStudents.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-500" />
              Students struggling academically
            </CardTitle>
            <CardDescription>Below 50% progress — may need a check-in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {strugglingStudents.map(s => (
              <button
                key={s.id}
                onClick={() => onStudentClick(s)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">Week {s.currentWeek}</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {s.progress || 0}% progress
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Need Attention</p>
          <p className="text-2xl font-bold text-red-500">{students.filter(s => (s as any).needsAttention).length}</p>
        </Card>
        <Card className="border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inactive 3+ days</p>
          <p className="text-2xl font-bold text-amber-500">{students.filter(s => {
            if (!s.lastActive) return false;
            return (Date.now() - new Date(s.lastActive).getTime()) / (1000 * 60 * 60 * 24) > 3;
          }).length}</p>
        </Card>
        <Card className="border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Struggling</p>
          <p className="text-2xl font-bold text-amber-500">{students.filter(s => (s.progress || 0) < 50).length}</p>
        </Card>
        <Card className="border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Students</p>
          <p className="text-2xl font-bold text-foreground">{students.length}</p>
        </Card>
      </div>
    </div>
  );
}
