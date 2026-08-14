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
} from "@/modules/ui/card";
import { Badge } from "@/modules/ui/badge";
import { Button } from "@/modules/ui/button";
import { Progress } from "@/modules/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/modules/ui/table";
import {
  DollarSign, TrendingUp, Clock, Gauge,
  RefreshCw, AlertTriangle, Lightbulb,
  CheckCircle2, Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";
import { DashboardHeader } from "@/modules/ui/dashboard-shell";
import { StatCard } from "@/modules/ui/stat-card";
import { SkeletonPanel, EmptyState, ErrorState } from "@/modules/ui/states";

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
    className: "bg-growth-sage-soft text-growth-sage dark:text-growth-sage border-growth-sage",
    dot: "bg-growth-sage",
  },
  needs_attention: {
    label: "Needs Attention",
    className: "bg-growth-amber-soft text-growth-amber dark:text-growth-amber border-growth-amber",
    dot: "bg-growth-amber",
  },
  at_risk: {
    label: "At Risk",
    className: "bg-destructive/5 text-destructive dark:text-destructive border-destructive/30",
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
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Employer" }]}
          title="Loading dashboard…"
          subtitle="Fetching trainee progress and ROI"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonPanel key={i} lines={2} className="h-24" />
            ))}
          </div>
          <SkeletonPanel lines={6} className="h-96" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          crumbs={[{ label: "Employer" }]}
          title="Employer Dashboard"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <ErrorState
            message={error}
            onRetry={() => { setRefreshing(true); load(); }}
          />
        </div>
      </div>
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
      accent: "text-growth-sage",
    },
    {
      label: "ROI Multiplier",
      value: `${data.roiMultiplier}×`,
      icon: <Gauge className="h-4 w-4" />,
      sub: "gain vs investment",
      accent: data.roiMultiplier >= 1 ? "text-growth-sage" : "text-growth-amber",
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
      <DashboardHeader
        crumbs={[{ label: "Employer" }]}
        title="Employer Dashboard"
        subtitle="B2B overview — sponsored trainee progress, ROI, and skill gaps."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "h-3.5 w-3.5 mr-1.5 animate-spin" : "h-3.5 w-3.5 mr-1.5"} />
            Refresh
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Cohort summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Trainees" value={data.totalTrainees} icon={Users} tone="info" />
        <StatCard label="Active (3d)" value={data.activeTrainees} icon={CheckCircle2} tone="success" />
        <StatCard label="Avg Completion" value={`${data.avgCompletionRate}%`} icon={Gauge} progress={data.avgCompletionRate} />
        <StatCard label="Avg Score" value={`${data.avgScore}%`} icon={TrendingUp} />
      </div>

      {/* ROI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {roiCards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            hint={c.sub}
            icon={c.icon as any}
            tone={c.accent.includes("emerald") ? "success" : c.accent.includes("amber") ? "warning" : c.accent.includes("blue") ? "info" : "default"}
          />
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
            <EmptyState
              icon="👥"
              title="No sponsored trainees yet"
              hint="Trainees you sponsor will appear here with their progress, scores, and status."
            />
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
                          t.avgScore >= 75 ? "text-growth-sage dark:text-growth-sage font-semibold" :
                          t.avgScore >= 50 ? "text-growth-amber dark:text-growth-amber font-semibold" :
                          "text-destructive dark:text-destructive font-semibold"
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
            <Lightbulb className="h-4 w-4 text-growth-amber" />
            Skill Gap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.skillGaps.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No skill gaps detected"
              hint="All topics are above 60% mastery across your sponsored trainees."
            />
          ) : (
            <div className="space-y-2">
              {data.skillGaps.map((g) => (
                <div
                  key={g.skill}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40"
                >
                  <div className="w-8 h-8 rounded-md bg-growth-amber-soft border border-growth-amber flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-growth-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{g.skill}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Avg mastery: <span className="text-growth-amber dark:text-growth-amber font-medium">{g.avgMastery}%</span></span>
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
    </div>
  );
}
