"use client";

/**
 * StudentBriefing — compact card shown at the top of the student portfolio.
 *
 * Fetches from /api/instructor/student-briefing?studentId=... and shows:
 *  - A 3-sentence heuristic briefing (conversational)
 *  - A highlighted "suggested talking point"
 *  - Quick stats: week/day, avg score, status badge
 *  - A "Message Student" button
 *
 * Includes loading skeleton + error state with retry.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Mail, AlertTriangle, RefreshCw, Lightbulb, CalendarDays, Gauge,
} from "lucide-react";
import { api } from "@/lib/api-client";

interface BriefingData {
  briefing: string;
  suggestedTalkingPoint: string;
  week: number;
  day: number;
  avgScore: number;
  lastActive: string | null;
  status: "on_track" | "needs_attention" | "at_risk";
  weakTopics: string[];
  hasProjectTask: boolean;
  completedCheckInToday: boolean;
}

interface Props {
  studentId: string;
  onMessage?: () => void;
}

const STATUS_META: Record<BriefingData["status"], { label: string; className: string }> = {
  on_track: {
    label: "On Track",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  needs_attention: {
    label: "Needs Attention",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  at_risk: {
    label: "At Risk",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
};

function fmtLastActive(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    return hours <= 0 ? "Just now" : `${hours}h ago`;
  }
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function StudentBriefing({ studentId, onMessage }: Props) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<BriefingData>(
        `/api/instructor/student-briefing?studentId=${encodeURIComponent(studentId)}`,
      );
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load briefing";
      // Silent — this is a non-critical widget. Don't spam toasts.
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
  }, [load]);

  // Loading skeleton — compact card shape.
  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-full mb-1.5" />
          <Skeleton className="h-3 w-11/12 mb-1.5" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state — compact, with retry.
  if (error && !data) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Briefing unavailable</p>
              <p className="text-[10px] text-muted-foreground truncate">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-shrink-0"
            onClick={() => { setLoading(true); load(); }}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const status = STATUS_META[data.status];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Mentor Briefing</span>
            <span className="text-[10px] text-muted-foreground">AI-heuristic · always free</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onMessage?.()}
          >
            <Mail className="h-3 w-3 mr-1" /> Message Student
          </Button>
        </div>

        {/* The 3-sentence briefing */}
        <p className="text-sm text-foreground/90 leading-relaxed">
          {data.briefing}
        </p>

        {/* Suggested talking point */}
        <div className="rounded-md bg-primary/10 border border-primary/20 p-2.5">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                Suggested talking point
              </div>
              <p className="text-xs text-foreground mt-0.5">{data.suggestedTalkingPoint}</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            <CalendarDays className="h-3 w-3 mr-1" />
            Week {data.week} · Day {data.day}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Gauge className="h-3 w-3 mr-1" />
            Avg: {data.avgScore > 0 ? `${data.avgScore}%` : "—"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Last active: {fmtLastActive(data.lastActive)}
          </Badge>
          <Badge variant="outline" className={`text-[10px] ${status.className}`}>
            {status.label}
          </Badge>
          {data.weakTopics.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
              Weak: {data.weakTopics.join(", ")}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
