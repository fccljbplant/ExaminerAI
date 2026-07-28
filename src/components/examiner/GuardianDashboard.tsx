"use client";

/**
 * GuardianDashboard — a purpose-built interface for parents/guardians.
 *
 * NOT a student dashboard clone. Guardians have fundamentally different needs:
 * 1. "How is my child doing overall?" → Overview snapshot
 * 2. "Are there any concerns?" → Concerns + alerts
 * 3. "What did my child do this week?" → Activity timeline
 * 4. "How can I help?" → Teacher recommendations + messaging
 *
 * Design principles:
 * - Simple, non-technical language (no jargon, no "SRL phase" or "calibration")
 * - Positive framing first (wins before concerns)
 * - Clear visual hierarchy (big numbers, color-coded wellbeing)
 * - One page, scrollable — no complex navigation
 * - Mobile-first (most parents check on their phone)
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Heart,
  MessageSquare, Calendar, Award, Activity, Clock, Mail,
  Sparkles, Brain, BookOpen, ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Area, AreaChart,
} from "recharts";

interface GuardianData {
  student: {
    id: string;
    name: string;
    email: string;
    currentWeek: number;
    projectName: string | null;
  };
  relationship: string;
  snapshot: {
    wellbeingTier: string;
    latestGrade: string | null;
    latestScore: number | null;
    avgScore: number | null;
    engagementStreak: number;
    activeDaysThisWeek: number;
    tutorMessagesThisWeek: number;
    testsThisWeek: number;
  };
  concerns: string[];
  wins: string[];
  weeklySummary: Array<{ week: number; score: number | null; grade: string | null }>;
  recentActivity: Array<{ type: string; title: string; description: string; date: string }>;
  teacherComments: Array<{ teacherName: string; body: string; createdAt: string }>;
  teacher: { name: string; email: string } | null;
  reportCards: Array<{
    week: number; grade: string; score: number;
    strengths: string; weaknesses: string;
    workHabits: string; progress: string; examinerObservations: string;
  }>;
}

interface GuardianDashboardProps {
  onMessage?: () => void;
}

export default function GuardianDashboard({ onMessage }: GuardianDashboardProps = {}) {
  const [data, setData] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<GuardianData>("/api/guardian/overview");
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load your child's overview");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

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

  const tierColor = data.snapshot.wellbeingTier === "green"
    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
    : data.snapshot.wellbeingTier === "warning"
    ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
    : "text-rose-600 bg-rose-50 dark:bg-rose-950/30";

  const tierLabel = data.snapshot.wellbeingTier === "green"
    ? "Doing Well"
    : data.snapshot.wellbeingTier === "warning"
    ? "Needs Attention"
    : "Concern";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ============================================ */}
      {/* HEADER — child info + refresh */}
      {/* ============================================ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary text-primary-foreground text-base font-bold">
              {data.student.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{data.student.name}</h1>
            <p className="text-xs text-muted-foreground">
              {data.relationship} · Week {data.student.currentWeek}
              {data.student.projectName && ` · ${data.student.projectName}`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ============================================ */}
      {/* WELLBEING BANNER — the #1 thing a parent wants to know */}
      {/* ============================================ */}
      <Card className={cn("border-2", data.snapshot.wellbeingTier === "green" ? "border-emerald-300 dark:border-emerald-800" : data.snapshot.wellbeingTier === "warning" ? "border-amber-300 dark:border-amber-800" : "border-rose-300 dark:border-rose-800")}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", tierColor)}>
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Wellbeing Status</div>
                <div className={cn("text-lg font-bold", tierColor.split(" ")[0])}>{tierLabel}</div>
              </div>
            </div>
            <Badge className={tierColor}>
              {data.snapshot.wellbeingTier.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* SNAPSHOT CARDS — 4 key metrics */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SnapshotCard
          icon={Award}
          label="Latest Grade"
          value={data.snapshot.latestGrade || "—"}
          subtitle={data.snapshot.latestScore !== null ? `${data.snapshot.latestScore}%` : "No tests yet"}
          color="text-amber-600"
        />
        <SnapshotCard
          icon={TrendingUp}
          label="Average Score"
          value={data.snapshot.avgScore !== null ? `${data.snapshot.avgScore}%` : "—"}
          subtitle={data.snapshot.avgScore !== null && data.snapshot.avgScore >= 70 ? "Above target" : "Below target"}
          color={data.snapshot.avgScore !== null && data.snapshot.avgScore >= 70 ? "text-emerald-600" : "text-amber-600"}
        />
        <SnapshotCard
          icon={Activity}
          label="Engagement"
          value={`${data.snapshot.engagementStreak} days`}
          subtitle="Active streak"
          color="text-blue-600"
        />
        <SnapshotCard
          icon={Calendar}
          label="Active This Week"
          value={`${data.snapshot.activeDaysThisWeek}/7`}
          subtitle={`${data.snapshot.tutorMessagesThisWeek} AI sessions`}
          color="text-purple-600"
        />
      </div>

      {/* ============================================ */}
      {/* WINS + CONCERNS — two-column on desktop */}
      {/* ============================================ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Wins */}
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Wins to Celebrate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.wins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No specific wins yet. Encourage your child to keep practicing!
              </p>
            ) : (
              <div className="space-y-2">
                {data.wins.map((win, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-emerald-900 dark:text-emerald-200">{win}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concerns */}
        <Card className={cn(data.concerns.length > 0 && "border-amber-200 dark:border-amber-900")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Areas to Watch
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.concerns.length === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No concerns right now. Your child is on track!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.concerns.map((concern, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-amber-900 dark:text-amber-200">{concern}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* SCORE TREND — visual, not technical */}
      {/* ============================================ */}
      {data.weeklySummary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Test Score Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Your child's weekly test scores over the last {data.weeklySummary.length} weeks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.weeklySummary.map(w => ({ week: `Week ${w.week}`, score: w.score || 0 }))}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#scoreGradient)"
                  dot={{ fill: "var(--chart-1)", r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* RECENT ACTIVITY — what happened this week */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription className="text-xs">
            What your child has been doing on the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity. Encourage your child to log in and practice.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.map((activity, i) => (
                <ActivityRow key={i} activity={activity} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* TEACHER COMMENTS — direct communication */}
      {/* ============================================ */}
      {data.teacherComments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Teacher Updates
            </CardTitle>
            <CardDescription className="text-xs">
              Recent notes from your child's instructor
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {data.teacherComments.map((comment, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {comment.teacherName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{comment.teacherName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* CONTACT TEACHER — direct action */}
      {/* ============================================ */}
      {data.instructor && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Message {data.instructor.name}</div>
                  <div className="text-xs text-muted-foreground">Your child's teacher — ask questions, share concerns</div>
                </div>
              </div>
              {onMessage && (
                <Button onClick={onMessage} size="sm">
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  Send Message
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* REPORT CARDS — academic detail (expandable) */}
      {/* ============================================ */}
      {data.reportCards.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Recent Report Cards
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {data.reportCards.map((rc, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Week {rc.week}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("font-mono", gradeColor(rc.grade))}>
                        {rc.grade}
                      </Badge>
                      <span className="text-sm font-bold">{rc.score}%</span>
                    </div>
                  </div>
                  {rc.examinerObservations && (
                    <p className="text-xs text-muted-foreground mb-2">{rc.examinerObservations}</p>
                  )}
                  {rc.progress && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Progress:</strong> {rc.progress}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SnapshotCard({ icon: Icon, label, value, subtitle, color }: {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
        <div className={cn("text-xl font-bold", color)}>{value}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: { type: string; title: string; description: string; date: string } }) {
  const iconMap: Record<string, any> = {
    test: Award,
    checkin: Calendar,
    project: BookOpen,
    comment: MessageSquare,
    alert: AlertCircle,
  };
  const colorMap: Record<string, string> = {
    test: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
    checkin: "text-blue-600 bg-blue-50 dark:bg-blue-950/20",
    project: "text-purple-600 bg-purple-50 dark:bg-purple-950/20",
    comment: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
    alert: "text-rose-600 bg-rose-50 dark:bg-rose-950/20",
  };
  const Icon = iconMap[activity.type] || Activity;
  const color = colorMap[activity.type] || "text-muted-foreground bg-muted";

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{activity.title}</div>
        <div className="text-xs text-muted-foreground truncate">{activity.description}</div>
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
        {timeAgo(activity.date)}
      </span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "B": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    case "C": return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "D": return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
    case "F": return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    default: return "";
  }
}
