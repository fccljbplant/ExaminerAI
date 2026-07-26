"use client";

/**
 * TeacherLoadPanel — shows the teacher's own wellbeing/load metrics.
 *
 * H10 fix (audit 2026-07-26): the teacher-load module + /api/teacher/load
 * endpoint existed but had NO UI consumer — teachers couldn't see their own
 * load metrics. This component surfaces:
 *   - Overall tier (green/amber/red) with reasons
 *   - Response time trend (last 4 weeks vs this week)
 *   - Touchpoint completion rate
 *   - Load vs capacity (assigned students vs historical baseline)
 *   - Crisis load (open crisis flags across their students)
 *
 * Wired into the teacher's TodayView.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Activity, Clock, HeartHandshake, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeacherLoadData {
  tier: "green" | "amber" | "red" | string;
  tierReasons: string[];
  responseTimeTrend: {
    thisWeekAvgHours: number | null;
    last4WeeksAvgHours: number | null;
    trend: "improving" | "stable" | "worsening" | string;
  };
  touchpointCompletionRate: {
    completed: number;
    overdue: number;
    rate: number; // 0-100
  };
  loadVsCapacity: {
    assignedStudents: number;
    baseline: number | null;
    ratio: number | null; // assigned / baseline
  };
  crisisLoad: {
    openCrisisFlags: number;
    openAlerts: number;
  };
}

export function TeacherLoadPanel() {
  const [data, setData] = useState<TeacherLoadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<TeacherLoadData>("/api/teacher/load");
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load teacher metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your load metrics...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-4 text-xs text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const tierColor = data.tier === "green"
    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30"
    : data.tier === "amber" || data.tier === "warning"
    ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-500/30"
    : "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-500/30";

  const tierLabel = data.tier === "green" ? "Healthy" : (data.tier === "amber" || data.tier === "warning") ? "Elevated" : "High";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Your Load + Wellbeing
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Computed from your response times, touchpoint completion, and student load. Fully transparent — hover any metric for details.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] capitalize", tierColor)}>
              {tierLabel}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing} className="h-7 text-xs">
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tier reasons */}
        {data.tierReasons.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Why this tier</p>
            <ul className="text-xs text-foreground space-y-0.5">
              {data.tierReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-muted-foreground">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Response time */}
          <div className="rounded-md border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Response Time</p>
            </div>
            <p className="text-sm font-bold text-foreground">
              {data.responseTimeTrend.thisWeekAvgHours !== null
                ? `${data.responseTimeTrend.thisWeekAvgHours}h`
                : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.responseTimeTrend.last4WeeksAvgHours !== null
                ? `vs ${data.responseTimeTrend.last4WeeksAvgHours}h avg (4wk)`
                : "no prior data"}
              {" · "}
              <span className={
                data.responseTimeTrend.trend === "improving" ? "text-emerald-600" :
                data.responseTimeTrend.trend === "worsening" ? "text-amber-600" :
                "text-muted-foreground"
              }>
                {data.responseTimeTrend.trend}
              </span>
            </p>
          </div>

          {/* Touchpoint completion */}
          <div className="rounded-md border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <HeartHandshake className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Touchpoints</p>
            </div>
            <p className="text-sm font-bold text-foreground">{data.touchpointCompletionRate.rate}%</p>
            <Progress value={data.touchpointCompletionRate.rate} className="h-1 mt-1" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.touchpointCompletionRate.completed} done · {data.touchpointCompletionRate.overdue} overdue
            </p>
          </div>

          {/* Load vs capacity */}
          <div className="rounded-md border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Student Load</p>
            </div>
            <p className="text-sm font-bold text-foreground">{data.loadVsCapacity.assignedStudents}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.loadVsCapacity.baseline !== null
                ? `vs ${data.loadVsCapacity.baseline} baseline (${data.loadVsCapacity.ratio !== null ? Math.round(data.loadVsCapacity.ratio * 100) : 0}%)`
                : "no baseline yet"}
            </p>
          </div>

          {/* Crisis load */}
          <div className="rounded-md border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Crisis Load</p>
            </div>
            <p className="text-sm font-bold text-foreground">{data.crisisLoad.openCrisisFlags}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              open crisis flags · {data.crisisLoad.openAlerts} open alerts
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
