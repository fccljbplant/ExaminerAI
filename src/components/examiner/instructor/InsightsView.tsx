"use client";

/**
 * InsightsView — course-level analytics + AI Assistant for weekly review.
 *
 * This is the "zoom out" view. Where Today is tactical (who needs me now),
 * Insights is strategic (how is the course trending? what should I plan?).
 *
 * Sections:
 * 1. Batch distribution — wellbeing tiers, score distribution, engagement
 * 2. Trend charts — score trend, engagement trend, alert volume
 * 3. Topic mastery heatmap — which topics are course-wide weak spots
 * 4. AI Assistant — free-text Q&A about the course ("Who's likely to drop off?")
 */

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Users, Brain,
  Send, Loader2, Sparkles, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";
import { cn } from "@/lib/utils";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import type { StudentRow } from "@/components/examiner/instructor/types";
import { CohortAnalyticsView } from "@/components/examiner/instructor/CohortAnalyticsView";

interface InsightsViewProps {
  students: StudentRow[];
  stats: any;
  alerts: any[];
  onStudentClick: (student: StudentRow) => void;
  /** Optional courseId — passed through to CohortAnalyticsView. */
  courseId?: string;
  /** Optional callback — passed through to CohortAnalyticsView. */
  onMessageStudent?: () => void;
}

const WELLBEING_COLORS = { green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

export function InsightsView({ students, stats, alerts, onStudentClick, courseId, onMessageStudent }: InsightsViewProps) {
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  // Defensive: ensure students is always an array
  const safeStudents = Array.isArray(students) ? students : [];

  // Batch distribution data
  const distribution = useMemo(() => {
    const total = safeStudents.length || 1;
    const needingAttention = safeStudents.filter(s => s?.needsAttention).length;
    const onTrack = total - needingAttention;
    return [
      { name: "On Track", value: onTrack, color: WELLBEING_COLORS.green },
      { name: "Need Attention", value: needingAttention, color: WELLBEING_COLORS.amber },
    ].filter(d => d.value > 0);
  }, [students]);

  // Score distribution (buckets)
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-39", count: 0, color: "#ef4444" },
      { range: "40-59", count: 0, color: "#f97316" },
      { range: "60-69", count: 0, color: "#f59e0b" },
      { range: "70-79", count: 0, color: "#eab308" },
      { range: "80-89", count: 0, color: "#84cc16" },
      { range: "90-100", count: 0, color: "#10b981" },
    ];
    safeStudents.forEach(s => {
      if (s.latestScore == null) return;
      const score = s.latestScore;
      if (score < 40) buckets[0].count++;
      else if (score < 60) buckets[1].count++;
      else if (score < 70) buckets[2].count++;
      else if (score < 80) buckets[3].count++;
      else if (score < 90) buckets[4].count++;
      else buckets[5].count++;
    });
    return buckets.filter(b => b.count > 0);
  }, [students]);

  // Engagement distribution (last active buckets)
  const engagementDistribution = useMemo(() => {
    const now = Date.now();
    const today = safeStudents.filter(s => s.lastActive && now - new Date(s.lastActive).getTime() < 86400000).length;
    const thisWeek = safeStudents.filter(s => s.lastActive && now - new Date(s.lastActive).getTime() < 7 * 86400000).length - today;
    const older = safeStudents.filter(s => s.lastActive && now - new Date(s.lastActive).getTime() >= 7 * 86400000).length;
    const never = safeStudents.filter(s => !s.lastActive).length;
    return [
      { name: "Active Today", value: today, color: "#10b981" },
      { name: "This Week", value: thisWeek, color: "#3b82f6" },
      { name: "Older", value: older, color: "#f59e0b" },
      { name: "Never", value: never, color: "#94a3b8" },
    ].filter(d => d.value > 0);
  }, [students]);

  // Top performers + struggling students
  const topPerformers = useMemo(() =>
    [...safeStudents].filter(s => s?.latestScore != null).sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0)).slice(0, 5),
    [safeStudents]
  );
  const strugglingStudents = useMemo(() =>
    [...safeStudents].filter(s => s?.needsAttention).sort((a, b) => (b.attentionScore || 0) - (a.attentionScore || 0)).slice(0, 5),
    [safeStudents]
  );

  const handleAssistantAsk = async () => {
    if (!assistantQuery.trim()) return;
    setAssistantLoading(true);
    setAssistantAnswer(null);
    try {
      const res = await api.post<{ answer: string }>("/api/instructor/assistant", { question: assistantQuery }, AI_TIMEOUT_MS);
      setAssistantAnswer(res.answer);
    } catch (e: any) {
      setAssistantAnswer(`Unable to get AI insight: ${e.message}`);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ============================================ */}
      {/* AI ASSISTANT */}
      {/* ============================================ */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            AI Assistant — Ask about your class
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., 'Who's likely to drop off?' or 'Which students improved most this week?'"
              value={assistantQuery}
              onChange={(e) => setAssistantQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAssistantAsk()}
              className="text-sm"
            />
            <Button onClick={handleAssistantAsk} disabled={assistantLoading || !assistantQuery.trim()}>
              {assistantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              "Who needs a check-in today?",
              "Which students are improving?",
              "Any patterns in low scores?",
              "Who hasn't been active this week?",
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => setAssistantQuery(prompt)}
                className="text-[10px] px-2 py-1 rounded-full border bg-card hover:bg-accent transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
          {assistantAnswer && (
            <div className="mt-3 p-3 rounded-lg bg-card border text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">{assistantAnswer}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* DISTRIBUTION CHARTS */}
      {/* ============================================ */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Wellbeing distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Class Health</CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Score distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">No test scores yet</div>
            )}
          </CardContent>
        </Card>

        {/* Engagement distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={engagementDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {engagementDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* TOP PERFORMERS + STRUGGLING */}
      {/* ============================================ */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topPerformers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No test scores yet.</div>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => onStudentClick(s)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">Week {s.currentWeek}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {s.latestScore}%
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Need Most Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {strugglingStudents.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                <div className="text-xs text-muted-foreground">All students on track!</div>
              </div>
            ) : (
              <div className="space-y-2">
                {strugglingStudents.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => onStudentClick(s)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {(s.attentionReasons || []).slice(0, 2).join("; ")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                      {s.attentionScore}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* BATCH SUMMARY */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Class Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Total Students</div>
              <div className="text-lg font-semibold mt-1">{stats?.totalStudents || safeStudents.length}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Tests This Week</div>
              <div className="text-lg font-semibold mt-1">{stats?.testsThisWeek || 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">With Projects</div>
              <div className="text-lg font-semibold mt-1">{stats?.studentsWithProjects || 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Active Today</div>
              <div className="text-lg font-semibold mt-1">{stats?.totalActiveToday || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MERGED: Cohort Analytics used to be a separate tab. Now it lives
          here as a section so the instructor sees strategic trends + cohort
          performance in one scroll. The AI Assistant above answers
          "who's likely to drop off?"; this section answers "which week
          was hardest, which topics need reteaching." */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Cohort Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CohortAnalyticsView
            courseId={courseId}
            onMessageStudent={onMessageStudent}
          />
        </CardContent>
      </Card>
    </div>
  );
}
