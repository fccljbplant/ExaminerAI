"use client";

/**
 * GuardianReportCards — distinct from the GuardianDashboard overview.
 *
 * H14 fix (audit 2026-07-26): the previous version of the "Report Cards"
 * nav item for guardians rendered <GuardianDashboard /> (the same Overview
 * page) — so the two nav items showed identical content. This component is
 * a proper, dedicated report-card view that shows ALL report cards (not
 * just the few in the overview), with full details: strengths, weaknesses,
 * work habits, progress, examiner observations, and next steps.
 *
 * Reuses the same /api/guardian/overview endpoint (already returns all report
 * cards), but renders them in a focused, expanded layout.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gradeColor } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, RefreshCw, FileText, BookOpen, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

interface ReportCard {
  week: number;
  grade: string;
  score: number;
  strengths: string;
  weaknesses: string;
  workHabits: string;
  progress: string;
  examinerObservations: string;
  nextSteps?: string;
  date?: string;
}

interface GuardianReportCardsData {
  student: { id: string; name: string; email: string; currentWeek: number };
  reportCards: ReportCard[];
}

export default function GuardianReportCards() {
  const [data, setData] = useState<GuardianReportCardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<GuardianReportCardsData>("/api/guardian/overview");
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load report cards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h3 className="font-semibold text-base mb-1">Setup needed</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const reportCards = [...data.reportCards].sort((a, b) => b.week - a.week); // most recent first
  const chartData = [...data.reportCards].sort((a, b) => a.week - b.week).map(rc => ({
    week: `Wk ${rc.week}`,
    score: rc.score,
    grade: rc.grade,
  }));

  // Compute trend: avg of last 3 vs avg of previous 3
  const recentScores = reportCards.slice(0, 3).map(rc => rc.score);
  const previousScores = reportCards.slice(3, 6).map(rc => rc.score);
  const recentAvg = recentScores.length > 0 ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : null;
  const previousAvg = previousScores.length > 0 ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length) : null;
  const trend = (recentAvg !== null && previousAvg !== null) ? recentAvg - previousAvg : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Report Cards
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All weekly report cards for {data.student.name}. Click a card to expand.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {/* Empty state */}
      {reportCards.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No report cards yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Report cards are generated weekly by the AI once your child completes their weekly test. Check back after the first weekly test is graded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score trend chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Score Trend
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Weekly test scores over time — {reportCards.length} report card{reportCards.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                {trend !== null && (
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    trend > 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                    trend < 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                    "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}>
                    {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}% vs prior 3
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2} dot={{ fill: "var(--chart-1)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Report cards list */}
          <div className="space-y-2">
            {reportCards.map((rc) => {
              const isExpanded = expandedWeek === rc.week;
              return (
                <Card key={rc.week} className="border-border">
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : rc.week)}
                    className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className={cn("font-mono text-sm", gradeColor(rc.grade))}>
                        {rc.grade}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-foreground">Week {rc.week}</p>
                        {rc.date && (
                          <p className="text-[10px] text-muted-foreground">{new Date(rc.date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">{rc.score}%</span>
                      <span className="text-[10px] text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 px-4 pb-3 space-y-2 animate-fade-in-up">
                      {rc.examinerObservations && (
                        <div className="rounded-md bg-muted/40 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Examiner Observations</p>
                          <p className="text-xs text-foreground leading-snug">{rc.examinerObservations}</p>
                        </div>
                      )}
                      {rc.strengths && (
                        <div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Strengths</p>
                          <p className="text-xs text-foreground leading-snug">{rc.strengths}</p>
                        </div>
                      )}
                      {rc.weaknesses && (
                        <div>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Areas to Improve</p>
                          <p className="text-xs text-foreground leading-snug">{rc.weaknesses}</p>
                        </div>
                      )}
                      {rc.workHabits && (
                        <div>
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">Work Habits</p>
                          <p className="text-xs text-foreground leading-snug">{rc.workHabits}</p>
                        </div>
                      )}
                      {rc.progress && (
                        <div>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Progress</p>
                          <p className="text-xs text-foreground leading-snug">{rc.progress}</p>
                        </div>
                      )}
                      {rc.nextSteps && (
                        <div>
                          <p className="text-[10px] text-primary uppercase tracking-wider mb-0.5">Next Steps</p>
                          <p className="text-xs text-foreground leading-snug">{rc.nextSteps}</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
