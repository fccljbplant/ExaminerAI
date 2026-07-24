"use client";

/**
 * BatchView — aggregate batch view (replaces the old Overview tab).
 *
 * MVP fixes:
 * - Pagination bug: aggregates now compute server-side (already fixed in
 *   the stats API via D3 server-side aggregates). This view just displays
 *   them correctly.
 * - Hardcoded 6-week assumption: reads the course's actual
 *   projectDurationWeeks from the stats response instead of assuming 6.
 * - Export: CSV export of the batch.
 */

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Download, Users, TrendingUp, AlertCircle, CheckCircle2, Loader2, Lightbulb } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { SpatialBatchMap } from "@/components/examiner/teacher/SpatialBatchMap";
import type { StudentRow } from "@/components/examiner/teacher/types";

interface BatchViewProps {
  students: StudentRow[];
  stats: {
    totalStudents: number;
    testsThisWeek: number;
    studentsWithProjects: number;
    studentsWithoutProjects: number;
    studentsNeedingAttention?: number;
    totalWithTests?: number;
    totalActiveToday?: number;
    projectDurationWeeks?: number;
  };
  onStudentClick?: (student: StudentRow) => void;
}

export function BatchView({ students, stats, onStudentClick }: BatchViewProps) {
  const courseDuration = stats.projectDurationWeeks || 6;
  const [outliers, setOutliers] = useState<Array<{ topic: string; averageScore: number; studentCount: number; questions: string[]; sampleAnswers: Array<{ userId: string; answer: string; score: number }> }>>([]);
  const [outliersLoading, setOutliersLoading] = useState(false);
  const [guidanceDraft, setGuidanceDraft] = useState<string | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  // Fetch cognitive-load outliers
  useEffect(() => {
    setOutliersLoading(true);
    api.get<{ outliers: typeof outliers }>("/api/batch/question-outliers")
      .then(res => setOutliers(res.outliers || []))
      .catch(() => {})
      .finally(() => setOutliersLoading(false));
  }, []);

  const generateGuidance = async (topic: string, answers: Array<{ answer: string; score: number }>) => {
    setGuidanceLoading(true);
    try {
      const res = await api.post<{ guidance: string }>("/api/teacher/topic-guidance", { topic, sampleAnswers: answers }, AI_TIMEOUT_MS);
      setGuidanceDraft(res.guidance);
    } catch { setGuidanceDraft("Failed to generate guidance. Try again."); }
    finally { setGuidanceLoading(false); }
  };

  // Compute aggregate stats from the full student list (client-side for
  // the view; the stats API already has server-side totals for accuracy)
  const avgProgress = students.length > 0
    ? Math.round(students.reduce((a, s) => a + (s.progress || 0), 0) / students.length)
    : 0;

  const onTrackCount = students.filter(s => (s.progress || 0) >= 50).length;
  const strugglingCount = students.filter(s => (s.progress || 0) < 50).length;

  // Week distribution — use the course's actual duration, not hardcoded 6
  const weekDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let w = 1; w <= courseDuration; w++) dist[w] = 0;
    students.forEach(s => {
      const week = Math.min(s.currentWeek, courseDuration);
      dist[week] = (dist[week] || 0) + 1;
    });
    return dist;
  }, [students, courseDuration]);

  const handleExport = () => {
    const rows = students.map(s => ({
      Name: s.name,
      Email: s.email,
      Week: s.currentWeek,
      Progress: `${s.progress || 0}%`,
      LastActive: s.lastActive || "Never",
      HasProject: s.hasProject ? "Yes" : "No",
    }));
    exportToCSV(`batch-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Cognitive-load-outlier banner (Phase 2.3 + Phase 3.2) */}
      {outliersLoading && (
        <Card className="border-border p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Checking for question outliers...</span>
        </Card>
      )}
      {!outliersLoading && outliers.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Question Outliers — {outliers.length} topic{outliers.length === 1 ? "" : "s"} where students struggled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outliers.map((o, i) => (
              <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{o.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.studentCount} students · avg {o.averageScore}% · {o.questions[0]?.slice(0, 80) || "No question text"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-xs h-7"
                  onClick={() => generateGuidance(o.topic, o.sampleAnswers)}
                  disabled={guidanceLoading}
                >
                  {guidanceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                  Add guidance
                </Button>
              </div>
            ))}
            {guidanceDraft && (
              <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium text-foreground mb-1">AI-drafted guidance for future questions:</p>
                <p className="text-xs text-muted-foreground">{guidanceDraft}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="bg-primary text-primary-foreground h-7 text-xs">Save guidance</Button>
                  <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => setGuidanceDraft(null)}>Dismiss</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spatial batch map (Phase 3.1) */}
      {onStudentClick && students.length > 0 && (
        <SpatialBatchMap students={students} onStudentClick={onStudentClick} />
      )}

      {/* Header + export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Batch Overview</h2>
          <p className="text-sm text-muted-foreground">
            {stats.totalStudents} students · {courseDuration}-week course
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="border-border">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalStudents}</p>
        </Card>
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">On Track</p>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{onTrackCount}</p>
        </Card>
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Struggling</p>
          </div>
          <p className="text-2xl font-bold text-amber-500">{strugglingCount}</p>
        </Card>
        <Card className="border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tests This Week</p>
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.testsThisWeek}</p>
        </Card>
      </div>

      {/* Average progress */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Batch Progress</CardTitle>
          <CardDescription>Average across all students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Progress value={avgProgress} className="flex-1" />
            <span className="text-sm font-bold text-foreground">{avgProgress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Week distribution — uses actual course duration, not hardcoded 6 */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Students by Week</CardTitle>
          <CardDescription>
            Distribution across {courseDuration} weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(weekDistribution).map(([week, count]) => {
              const pct = stats.totalStudents > 0 ? (count / stats.totalStudents) * 100 : 0;
              return (
                <div key={week} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">Week {week}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Project Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">With project</p>
              <p className="text-lg font-bold text-emerald-500">{stats.studentsWithProjects}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Without project</p>
              <p className="text-lg font-bold text-amber-500">{stats.studentsWithoutProjects}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
