"use client";

/**
 * MyLoadView — teacher wellbeing/load view.
 *
 * Mirrors the student wellbeing tier model (Green/Amber/Red), pointed
 * at the teacher, fully visible to the teacher themselves first.
 *
 * Explicitly labeled "only you see this" — the Principal view is
 * separate future work.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, HeartHandshake, Clock, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadData {
  teacherId: string;
  generatedAt: string;
  studentCount: number;
  responseTime: {
    rollingAverageHours: number;
    thisWeekHours: number;
    responseCount: number;
  };
  touchpoints: {
    thisWeek: number;
    completionRate: number;
    overdueStudentCount: number;
  };
  crisisLoad: number;
  tier: "green" | "amber" | "red";
  tierReasons: string[];
  visibility: string;
}

export function MyLoadView() {
  const [data, setData] = useState<LoadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LoadData>("/api/teacher/load")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-border">
        <CardContent className="p-6 text-center text-muted-foreground">
          Unable to load your wellbeing data right now.
        </CardContent>
      </Card>
    );
  }

  const tierColor = data.tier === "green" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
    : data.tier === "amber" ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
    : "text-red-600 bg-red-500/10 border-red-500/30";

  return (
    <div className="space-y-4">
      {/* Privacy notice */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Only you see this.</span> This data is not shared with
            your principal or anyone else. It's a self-awareness tool, not a performance review.
          </p>
        </CardContent>
      </Card>

      {/* Tier banner */}
      <Card className={cn("border-2", tierColor)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <HeartHandshake className="h-5 w-5" />
            Your Load: {data.tier.toUpperCase()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.tierReasons.map((reason, i) => (
            <p key={i} className="text-xs text-foreground">• {reason}</p>
          ))}
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Response time */}
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Response Time</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">This week</span>
              <span className="text-sm font-bold text-foreground">{data.responseTime.thisWeekHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Rolling avg (4 weeks)</span>
              <span className="text-sm font-medium text-muted-foreground">{data.responseTime.rollingAverageHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Responses logged</span>
              <span className="text-xs text-muted-foreground">{data.responseTime.responseCount}</span>
            </div>
          </div>
        </Card>

        {/* Touchpoint completion */}
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Touchpoint Coverage</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Progress value={data.touchpoints.completionRate} className="flex-1 h-2" />
              <span className="text-sm font-bold text-foreground">{data.touchpoints.completionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">This week</span>
              <span className="text-xs text-muted-foreground">{data.touchpoints.thisWeek} touchpoints</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Overdue</span>
              <span className={cn("text-xs font-medium", data.touchpoints.overdueStudentCount > 5 ? "text-amber-600" : "text-muted-foreground")}>
                {data.touchpoints.overdueStudentCount} students
              </span>
            </div>
          </div>
        </Card>

        {/* Crisis load */}
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={cn("h-4 w-4", data.crisisLoad > 2 ? "text-red-500" : "text-muted-foreground")} />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Crisis Load</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{data.crisisLoad}</p>
          <p className="text-xs text-muted-foreground">open crisis flags across your students</p>
        </Card>

        {/* Student count */}
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <HeartHandshake className="h-4 w-4 text-violet-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Caseload</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{data.studentCount}</p>
          <p className="text-xs text-muted-foreground">assigned students</p>
        </Card>
      </div>

      {/* Tier logic explanation */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How your tier is computed</CardTitle>
          <CardDescription className="text-xs">Fully transparent — you can audit this.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>• <span className="font-medium text-foreground">Amber</span> if: response time &gt;2x your rolling average, OR &gt;5 students overdue, OR &gt;2 open crisis flags</p>
          <p>• <span className="font-medium text-foreground">Red</span> if: response time &gt;4x your rolling average, OR &gt;10 students overdue, OR &gt;5 open crisis flags</p>
          <p>• Compared against <span className="font-medium text-foreground">your own baseline</span>, not other teachers</p>
        </CardContent>
      </Card>
    </div>
  );
}
