"use client";

/**
 * EmployerDashboard — B2B view for company managers / sponsors.
 *
 * Pulls from /api/employer/dashboard and renders:
 *  1. ROI Summary (4 cards: investment, productivity gain, ROI multiplier, time saved)
 *  2. Trainee Progress Table (per-trainee status + score + last active)
 *  3. Skill Gap Analysis (weak topics + recommended courses)
 *
 * Dark theme. Uses shadcn Card / Table / Badge / Progress.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, TrendingUp, Clock, Gauge,
  RefreshCw, Loader2, AlertTriangle, Lightbulb,
  CheckCircle2, Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";

type TraineeStatus = "on_track" | "needs_attention" | "at_risk" | "completed";

interface TraineeRow {
  userId: string;
  name: string;
  courseName: string;
  progress: number;
  avgScore: number;
  lastActive: string | null;
  status: TraineeStatus;
}
interface SkillGap {
  skill: string;
  avgMastery: number;
  recommendCourse: string;
}
interface EmployerData {
  totalTrainees: number;
  activeTrainees: number;
  avgCompletionRate: number;
  avgScore: number;
  totalInvestment: number;
  estimatedProductivityGain: number;
  roiMultiplier: number;
  timeSavedHours: number;
  trainees: TraineeRow[];
  skillGaps: SkillGap[];
}

const STATUS_META: Record<TraineeStatus, { label: string; className: string; dot: string }> = {
  on_track: {
    label: "On Track",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  needs_attention: {
    label: "Needs Attention",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  at_risk: {
    label: "At Risk",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    dot: "bg-red-500",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    dot: "bg-blue-500",
  },
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function fmtLastActive(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    return hours <= 0 ? "Just now" : `${hours}h ago`;
  }
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function EmployerDashboard() {
  const [data, setData] = useState<EmployerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EmployerData>("/api/employer/dashboard");
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load employer dashboard";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const roiCards = [
    {
      label: "Total Investment",
      value: fmtMoney(data.totalInvestment),
      icon: <DollarSign className="h-4 w-4" />,
      sub: `${data.totalTrainees} trainees enrolled`,
      accent: "text-primary",
    },
    {
      label: "Est. Productivity Gain",
      value: fmtMoney(data.estimatedProductivityGain),
      icon: <TrendingUp className="h-4 w-4" />,
      sub: "skill-based valuation",
      accent: "text-emerald-500",
    },
    {
      label: "ROI Multiplier",
      value: `${data.roiMultiplier}×`,
      icon: <Gauge className="h-4 w-4" />,
      sub: "gain vs investment",
      accent: data.roiMultiplier >= 1 ? "text-emerald-500" : "text-amber-500",
    },
    {
      label: "Time Saved",
      value: `${data.timeSavedHours}h`,
      icon: <Clock className="h-4 w-4" />,
      sub: "senior-eng hours saved",
      accent: "text-blue-500",
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Employer Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            B2B overview — sponsored trainee progress, ROI, and skill gaps.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "h-3.5 w-3.5 mr-1.5 animate-spin" : "h-3.5 w-3.5 mr-1.5"} />
          Refresh
        </Button>
      </div>

      {/* Cohort summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-card border border-border p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Total Trainees</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{data.totalTrainees}</div>
        </div>
        <div className="rounded-lg bg-card border border-border p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Active (3d)</div>
          <div className="text-xl font-bold text-emerald-500 mt-0.5">{data.activeTrainees}</div>
        </div>
        <div className="rounded-lg bg-card border border-border p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" /> Avg Completion</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{data.avgCompletionRate}%</div>
        </div>
        <div className="rounded-lg bg-card border border-border p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Avg Score</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{data.avgScore}%</div>
        </div>
      </div>

      {/* ROI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {roiCards.map((c) => (
          <Card key={c.label} className="bg-gradient-to-br from-card to-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <span className={c.accent}>{c.icon}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
              {c.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trainee Progress Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Trainee Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.trainees.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No sponsored trainees yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainee</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="w-[160px]">Progress</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trainees.map((t) => {
                  const meta = STATUS_META[t.status];
                  return (
                    <TableRow key={`${t.userId}-${t.courseName}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{t.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">{t.courseName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={t.progress} className="h-1.5 w-24" />
                          <span className="text-[10px] text-muted-foreground tabular-nums">{t.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          t.avgScore >= 75 ? "text-emerald-600 dark:text-emerald-400 font-semibold" :
                          t.avgScore >= 50 ? "text-amber-600 dark:text-amber-400 font-semibold" :
                          "text-red-600 dark:text-red-400 font-semibold"
                        }>
                          {t.avgScore > 0 ? `${t.avgScore}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtLastActive(t.lastActive)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Skill Gap Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Skill Gap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.skillGaps.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
              No skill gaps detected — all topics are above 60% mastery.
            </div>
          ) : (
            <div className="space-y-2">
              {data.skillGaps.map((g) => (
                <div
                  key={g.skill}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40"
                >
                  <div className="w-8 h-8 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{g.skill}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Avg mastery: <span className="text-amber-600 dark:text-amber-400 font-medium">{g.avgMastery}%</span></span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={g.avgMastery} className="h-1 w-32" />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Recommended</div>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {g.recommendCourse}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
