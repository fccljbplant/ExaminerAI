"use client";

/**
 * CohortAnalyticsView — instructor-facing cohort performance page.
 *
 * Pulls from /api/instructor/cohort-analytics and renders:
 *  1. Stats row (5 cards)
 *  2. Weekly Progress chart (bar chart: completion % + avg score per week)
 *  3. Topic Difficulty chart (horizontal bar, hardest first)
 *  4. Top Performers list
 *  5. Students at Risk list with "Message" button
 *
 * Dark theme. Uses recharts + existing shadcn components.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Cell,
} from "recharts";
import {
  Users, Activity, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle,
  RefreshCw, Loader2, Award, Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { showError } from "@/lib/toast-helpers";

interface TopicDifficulty {
  topic: string;
  avgScore: number;
  attemptCount: number;
}
interface WeeklyProgress {
  week: number;
  completionRate: number;
  avgScore: number;
}
interface TopPerformer {
  userId: string;
  name: string;
  avgScore: number;
  completionRate: number;
}
interface AtRiskStudent {
  userId: string;
  name: string;
  avgScore: number;
  lastActiveDays: number;
  missedTests: number;
}
interface CohortAnalytics {
  totalStudents: number;
  activeThisWeek: number;
  avgScore: number;
  avgScoreTrend: "up" | "steady" | "down";
  completionRate: number;
  studentsNeedingAttention: number;
  topicDifficulty: TopicDifficulty[];
  weeklyProgress: WeeklyProgress[];
  topPerformers: TopPerformer[];
  studentsAtRisk: AtRiskStudent[];
}

interface Props {
  courseId?: string;
  onMessageStudent?: (studentId: string) => void;
}

const TREND_ICONS = {
  up: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />,
  down: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
  steady: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
};

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981"; // emerald
  if (score >= 60) return "#f59e0b"; // amber
  if (score >= 50) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function CohortAnalyticsView({ courseId, onMessageStudent }: Props) {
  const [data, setData] = useState<CohortAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = `/api/instructor/cohort-analytics${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""}`;
      const res = await api.get<CohortAnalytics>(url);
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load analytics";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

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

  const stats = [
    {
      label: "Total Students",
      value: data.totalStudents,
      icon: <Users className="h-4 w-4" />,
      accent: "text-primary",
    },
    {
      label: "Active This Week",
      value: data.activeThisWeek,
      icon: <Activity className="h-4 w-4" />,
      accent: "text-emerald-500",
    },
    {
      label: "Avg Score",
      value: data.avgScore,
      icon: TREND_ICONS[data.avgScoreTrend],
      accent: "text-foreground",
      sub: data.avgScoreTrend === "up" ? "↑ vs last week" : data.avgScoreTrend === "down" ? "↓ vs last week" : "steady",
    },
    {
      label: "Completion Rate",
      value: `${data.completionRate}%`,
      icon: <CheckCircle2 className="h-4 w-4" />,
      accent: "text-blue-500",
      sub: "this week's test",
    },
    {
      label: "Needing Attention",
      value: data.studentsNeedingAttention,
      icon: <AlertTriangle className="h-4 w-4" />,
      accent: data.studentsNeedingAttention > 0 ? "text-amber-500" : "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Cohort Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Academic performance overview — based on weekly tests, daily tests, and assessment interactions.
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="bg-gradient-to-br from-card to-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className={s.accent}>{s.icon}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              {s.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly progress chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Weekly Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.weeklyProgress.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No weekly test data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => `Wk ${v}`} stroke="#52525b" />
                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} stroke="#52525b" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c1f",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  labelFormatter={(v) => `Week ${v}`}
                />
                <Bar dataKey="completionRate" name="Completion %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgScore" name="Avg Score" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> Completion %</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" /> Avg Score</span>
          </div>
        </CardContent>
      </Card>

      {/* Topic difficulty */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Topic Difficulty — Hardest First
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topicDifficulty.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No assessment interaction data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, data.topicDifficulty.length * 36)}>
              <BarChart data={data.topicDifficulty} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#a1a1aa" }} stroke="#52525b" />
                <YAxis
                  type="category"
                  dataKey="topic"
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  stroke="#52525b"
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c1f",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  formatter={(value: number, _name, props) => [
                    `${value}% (${props.payload.attemptCount} attempts)`,
                    "Avg Score",
                  ]}
                />
                <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                  {data.topicDifficulty.map((t, i) => (
                    <Cell key={i} fill={scoreColor(t.avgScore)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top performers + at risk */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.topPerformers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No top performers yet (avg score ≥ 75%).
              </div>
            ) : (
              <div className="space-y-2">
                {data.topPerformers.map((s, i) => (
                  <div
                    key={s.userId}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/40"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.completionRate}% completion</div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      {s.avgScore}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Students at Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.studentsAtRisk.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                No students at risk. Cohort looks healthy.
              </div>
            ) : (
              <div className="space-y-2">
                {data.studentsAtRisk.map((s) => (
                  <div
                    key={s.userId}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/40"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                      !
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                        <span>Avg: <span className="text-amber-600 dark:text-amber-400 font-medium">{s.avgScore}%</span></span>
                        <span>Last active: {s.lastActiveDays >= 999 ? "never" : `${s.lastActiveDays}d ago`}</span>
                        <span>Missed tests: {s.missedTests}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onMessageStudent?.(s.userId)}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Message
                    </Button>
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
