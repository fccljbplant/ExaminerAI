"use client";

/**
 * ComprehensiveReportView — displays the full private report for a student.
 *
 * Shows 4 sections:
 *   1. Executive Summary (AI narrative)
 *   2. Educational Analysis (scores, skills, project)
 *   3. Accomplishments + Areas to Improve
 *   4. Management Attitude (productivity, professionalism, leadership)
 *
 * Visible to:
 *   - The student themselves (their own report)
 *   - Instructors (for their course students)
 *   - Coordinator + Administrator (any student)
 */

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, FileText, Award, Target,
  TrendingUp, AlertTriangle, RefreshCw, Briefcase,
} from "lucide-react";

interface Report {
  id: string;
  userId: string;
  generatedAt: string;
  cached: boolean;
  educational: {
    overallScore: number;
    grade: string;
    weeklyTestScores: Array<{ week: number; score: number }>;
    skillMastery: Array<{ topic: string; level: string; trend: string }>;
    projectProgress: number;
    completedTasks: number;
    totalTasks: number;
  };
  accomplishments: string[];
  areasToImprove: Array<{ area: string; current: string; recommendation: string; priority: string }>;
  managementAttitude: {
    productivitySignals: string[];
    professionalismSignals: string[];
    leadershipPotential: string;
    managerReadiness: string;
    focusAreas: string[];
  };
  narrative: string;
}

const priorityColor = (priority: string) => {
  if (priority === "high") return "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-500/30";
  if (priority === "medium") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-500/30";
  return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30";
};

const readinessColor = (readiness: string) => {
  if (readiness === "Strong" || readiness === "Ready") return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30";
  if (readiness === "Almost Ready") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
  return "text-rose-600 bg-rose-50 dark:bg-rose-950/30";
};

export function ComprehensiveReportView({ studentId }: { studentId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/students/${studentId}/comprehensive-report${force ? "?forceRegenerate=true" : ""}`;
      const res = await api.get<{ report: Report }>(url, undefined, AI_TIMEOUT_MS);
      setReport(res.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const regenerate = async () => {
    setRegenerating(true);
    await load(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Generating comprehensive report...</p>
        <p className="text-xs text-muted-foreground mt-1">This analyzes all your data — it may take a few seconds.</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => load()} variant="outline" size="sm" className="mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Comprehensive Report
          </h3>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()}
            {report.cached && <Badge variant="outline" className="ml-2 text-[9px] bg-muted">cached</Badge>}
          </p>
        </div>
        <Button onClick={regenerate} disabled={regenerating} variant="outline" size="sm">
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Regenerate
        </Button>
      </div>

      {/* Section 1: Executive Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{report.narrative}</p>
        </CardContent>
      </Card>

      {/* Section 2: Educational Analysis */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" /> Educational Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-md bg-background border border-border">
              <div className="text-2xl font-bold text-foreground">{report.educational.overallScore}%</div>
              <div className="text-[10px] text-muted-foreground">Avg Score · Grade {report.educational.grade}</div>
            </div>
            <div className="text-center p-2 rounded-md bg-background border border-border">
              <div className="text-2xl font-bold text-foreground">{report.educational.projectProgress}%</div>
              <div className="text-[10px] text-muted-foreground">Project Progress</div>
            </div>
            <div className="text-center p-2 rounded-md bg-background border border-border">
              <div className="text-2xl font-bold text-foreground">{report.educational.completedTasks}/{report.educational.totalTasks}</div>
              <div className="text-[10px] text-muted-foreground">Tasks Done</div>
            </div>
            <div className="text-center p-2 rounded-md bg-background border border-border">
              <div className="text-2xl font-bold text-foreground">{report.educational.weeklyTestScores.length}</div>
              <div className="text-[10px] text-muted-foreground">Tests Completed</div>
            </div>
          </div>
          {report.educational.skillMastery.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Skill Mastery</p>
              <div className="flex flex-wrap gap-1">
                {report.educational.skillMastery.map(s => (
                  <Badge key={s.topic} variant="outline" className="text-[9px]">
                    {s.topic}: {s.level} ({s.trend})
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {report.educational.weeklyTestScores.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Weekly Test Scores</p>
              <div className="flex items-end gap-1 h-16">
                {report.educational.weeklyTestScores.map(t => (
                  <div key={t.week} className="flex-1 flex flex-col items-center justify-end">
                    <div
                      className="w-full rounded-t bg-primary/60"
                      style={{ height: `${Math.max(5, t.score)}%` }}
                      title={`Week ${t.week}: ${t.score}%`}
                    />
                    <span className="text-[8px] text-muted-foreground mt-0.5">W{t.week}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Accomplishments + Areas to Improve */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" /> Accomplishments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.accomplishments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accomplishments recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {report.accomplishments.map((a, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="text-emerald-600 mt-0.5">✓</span> {a}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" /> Areas to Improve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.areasToImprove.length === 0 ? (
              <p className="text-xs text-muted-foreground">No specific areas flagged. Keep up the good work!</p>
            ) : (
              report.areasToImprove.map((a, i) => (
                <div key={i} className={`p-2 rounded-md border ${priorityColor(a.priority)}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium">{a.area}</span>
                    <Badge variant="outline" className="text-[8px] capitalize">{a.priority}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">{a.current}</p>
                  <p className="text-[10px] text-foreground"><strong>Recommendation:</strong> {a.recommendation}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Management Attitude */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Management Attitude & Leadership Potential
          </CardTitle>
          <CardDescription className="text-xs">
            Forward-looking assessment of the student's readiness to take on management responsibilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Manager Readiness:</span>
            <Badge variant="outline" className={`text-[9px] ${readinessColor(report.managementAttitude.managerReadiness)}`}>
              {report.managementAttitude.managerReadiness}
            </Badge>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{report.managementAttitude.leadershipPotential}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1">Productivity Signals</p>
              <ul className="space-y-0.5">
                {report.managementAttitude.productivitySignals.map((s, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <span className="text-emerald-600">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1">Professionalism Signals</p>
              <ul className="space-y-0.5">
                {report.managementAttitude.professionalismSignals.map((s, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <span className="text-emerald-600">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {report.managementAttitude.focusAreas.length > 0 && (
            <div className="p-2 rounded-md bg-background border border-border">
              <p className="text-[10px] font-medium text-foreground mb-1">Focus Areas to Become a Manager</p>
              <ul className="space-y-0.5">
                {report.managementAttitude.focusAreas.map((f, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <Target className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
