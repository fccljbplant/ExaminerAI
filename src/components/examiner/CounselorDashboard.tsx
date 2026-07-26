"use client";

/**
 * CounselorDashboard — a massive powerful assistant for 1000 students.
 *
 * NOT a teacher dashboard clone. Counselors have fundamentally different jobs:
 * 1. Monitor wellbeing across the entire institution (not just one batch)
 * 2. Manage crisis flags + escalate when needed
 * 3. Conduct GROW mentorship sessions + track follow-ups
 * 4. Spot batch-level psychological patterns (frustration, avoidance, enthusiasm)
 * 5. Review anonymized cases with peers
 *
 * 4 views:
 * - Command Center: real-time triage (crises, alerts, follow-ups due, top concerns)
 * - Caseload: searchable roster with wellbeing tiers + concern scores
 * - Sessions: GROW touchpoint history + logger + case reviews
 * - Patterns: batch-level psych analytics + trend charts
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertCircle, Heart, Activity, TrendingUp, TrendingDown, Clock,
  CheckCircle2, AlertTriangle, Brain, Users, RefreshCw, Loader2,
  Sparkles, ChevronRight, Ban, FileWarning, Calendar, MessageSquare,
  Zap, Target, BarChart3, Search, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProminentTabs } from "@/components/shared/prominent-tabs";
import { VoiceTouchpointLogger } from "@/components/examiner/teacher/VoiceTouchpointLogger";
import { CaseReviewPanel } from "@/components/examiner/teacher/CaseReviewPanel";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar,
} from "recharts";

interface CounselorData {
  caseload: {
    totalStudents: number;
    greenCount: number;
    amberCount: number;
    redCount: number;
    openCrisisCount: number;
    openAlertCount: number;
    followUpsDueCount: number;
    avgMood: number;
    avgEngagement: number;
    totalFrustration: number;
    totalAvoidance: number;
    totalEnthusiasm: number;
  };
  crisisQueue: Array<{
    flagId: string; studentId: string; studentName: string; studentEmail: string;
    category: string; severity: string; status: string; wellbeingTier: string; createdAt: string;
  }>;
  alertQueue: Array<{
    alertId: string; studentId: string; studentName: string; studentEmail: string;
    type: string; severity: string; reason: string; metric: string; metricValue: string;
    wellbeingTier: string; createdAt: string;
  }>;
  followUpsDue: Array<{
    touchpointId: string; studentId: string; studentName: string;
    type: string; note: string; outcome: string | null; followUpDate: string | null; createdAt: string;
  }>;
  recentTouchpoints: Array<{
    touchpointId: string; studentId: string; studentName: string;
    type: string; note: string; outcome: string | null; followUpDate: string | null; createdAt: string;
  }>;
  topConcerns: Array<{
    studentId: string; studentName: string; studentEmail: string;
    wellbeingTier: string; alertCount: number; hasCrisisFlag: boolean;
    moodScore: number | null; engagementScore: number | null;
    frustrationCount: number; avoidanceCount: number; enthusiasmCount: number;
    concernScore: number; reasons: string[];
  }>;
  psychSummary: {
    totalEvidence: number;
    byDimension: Record<string, Record<string, number>>;
  };
  caseReviews: Array<{
    id: string; patternSummary: string; status: string; createdAt: string; postedBy: string;
  }>;
}

type CounselorTab = "command" | "caseload" | "sessions" | "patterns";

export default function CounselorDashboard({ onNavigateToMessages, onStudentClick }: { onNavigateToMessages?: () => void; onStudentClick?: (studentId: string, studentName: string) => void }) {
  const [data, setData] = useState<CounselorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<CounselorTab>("command");

  const load = useCallback(async () => {
    try {
      const res = await api.get<CounselorData>("/api/counselor/overview");
      setData(res);
    } catch (e) {
      // silent — error state handled by null check
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

  if (!data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to load counselor overview. Please refresh.</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const TABS: Array<{ key: CounselorTab; label: string; icon: any; badge?: number; badgeColor?: "warning" | "red" }> = [
    { key: "command", label: "Command Center", icon: Zap, badge: data.caseload.openCrisisCount || undefined, badgeColor: "red" as const },
    { key: "caseload", label: "Caseload", icon: Users },
    { key: "sessions", label: "Sessions", icon: Heart, badge: data.caseload.followUpsDueCount || undefined, badgeColor: "warning" as const },
    { key: "patterns", label: "Patterns", icon: Brain },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Counselor Dashboard</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {data.caseload.totalStudents} students
            </Badge>
            {data.caseload.redCount > 0 && (
              <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                {data.caseload.redCount} red tier
              </Badge>
            )}
            {data.caseload.amberCount > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {data.caseload.amberCount} amber tier
              </Badge>
            )}
            {data.caseload.openCrisisCount > 0 && (
              <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-400">
                {data.caseload.openCrisisCount} open crisis
              </Badge>
            )}
            {data.caseload.followUpsDueCount > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300">
                <Clock className="w-3 h-3 mr-1" />
                {data.caseload.followUpsDueCount} follow-ups due
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <ProminentTabs
        tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon, badge: t.badge, badgeColor: t.badgeColor }))}
        active={tab}
        onChange={(k) => setTab(k as CounselorTab)}
        variant="pill"
        size="md"
      />

      {/* Tab content */}
      {tab === "command" && <CommandCenter data={data} onNavigateToMessages={onNavigateToMessages} onStudentClick={onStudentClick} />}
      {tab === "caseload" && <CaseloadView data={data} onStudentClick={onStudentClick} />}
      {tab === "sessions" && <SessionsView data={data} onNavigateToMessages={onNavigateToMessages} onStudentClick={onStudentClick} />}
      {tab === "patterns" && <PatternsView data={data} />}
    </div>
  );
}

// ============================================================
// COMMAND CENTER — real-time triage
// ============================================================
function CommandCenter({ data, onNavigateToMessages, onStudentClick }: { data: CounselorData; onNavigateToMessages?: () => void; onStudentClick?: (studentId: string, studentName: string) => void }) {
  const { caseload } = data;
  const wellbeingData = [
    { name: "Green", value: caseload.greenCount, color: "#10b981" },
    { name: "Warning", value: caseload.amberCount, color: "#f59e0b" },
    { name: "Red", value: caseload.redCount, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Wellbeing pulse — 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Heart} label="Avg Mood" value={`${caseload.avgMood}/100`} color={caseload.avgMood >= 60 ? "text-emerald-600" : "text-amber-600"} />
        <StatCard icon={Activity} label="Avg Engagement" value={`${caseload.avgEngagement}/100`} color={caseload.avgEngagement >= 60 ? "text-emerald-600" : "text-amber-600"} />
        <StatCard icon={AlertTriangle} label="Frustration" value={caseload.totalFrustration} subtitle="signals this week" color="text-orange-600" />
        <StatCard icon={TrendingDown} label="Avoidance" value={caseload.totalAvoidance} subtitle="signals this week" color="text-rose-600" />
      </div>

      {/* Crisis queue */}
      <Card className={cn(data.crisisQueue.length > 0 && "border-rose-300 dark:border-rose-900")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            Crisis Queue
            {data.crisisQueue.length > 0 && <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-700">{data.crisisQueue.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.crisisQueue.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open crisis flags. All clear.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {data.crisisQueue.map(item => (
                <div key={item.flagId} className={cn("flex items-center gap-3 p-3 rounded-lg border",
                  item.severity === "red" ? "border-rose-300 bg-rose-50 dark:bg-rose-950/20" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                )}>
                  <AlertCircle className={cn("w-5 h-5 flex-shrink-0", item.severity === "red" ? "text-rose-600" : "text-amber-600")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.studentName}</span>
                      <Badge variant="outline" className="text-[9px] whitespace-nowrap">{item.category}</Badge>
                      <Badge variant="outline" className={cn("text-[9px]", item.severity === "red" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{item.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Tier: {item.wellbeingTier} · {timeAgo(item.createdAt)}</div>
                  </div>
                  {onStudentClick && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary hover:bg-primary/10 flex-shrink-0" onClick={() => onStudentClick(item.studentId, item.studentName)}>
                      Portfolio →
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alert queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Active Alerts
              {data.alertQueue.length > 0 && <Badge variant="secondary" className="text-[10px]">{data.alertQueue.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.alertQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No active alerts.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {data.alertQueue.slice(0, 15).map(alert => (
                  <div key={alert.alertId} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                      alert.severity === "red" ? "bg-rose-500" : "bg-amber-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{alert.studentName}</div>
                      <div className="text-xs text-muted-foreground truncate">{alert.reason}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px] whitespace-nowrap">{alert.type}</Badge>
                  </div>
                ))}
                {data.alertQueue.length > 15 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">+{data.alertQueue.length - 15} more alerts</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups due */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Follow-ups Due
              {data.followUpsDue.length > 0 && <Badge variant="secondary" className="text-[10px]">{data.followUpsDue.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.followUpsDue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups due this week.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {data.followUpsDue.map(fu => (
                  <div key={fu.touchpointId} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                    <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{fu.studentName}</div>
                      <div className="text-xs text-muted-foreground truncate">{fu.note.slice(0, 60)}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wellbeing distribution chart */}
      {wellbeingData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              Wellbeing Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 flex-wrap">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={wellbeingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {wellbeingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {wellbeingData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm font-medium">{d.name}</span>
                    <span className="text-sm text-muted-foreground">{d.value} ({Math.round(d.value / caseload.totalStudents * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// CASELOAD — searchable roster with wellbeing tiers
// ============================================================
function CaseloadView({ data, onStudentClick }: { data: CounselorData; onStudentClick?: (studentId: string, studentName: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "red" | "warning" | "crisis" | "alerts">("all");

  const filtered = data.topConcerns.filter(s => {
    if (search && !s.studentName.toLowerCase().includes(search.toLowerCase()) && !s.studentEmail.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "red" && s.wellbeingTier !== "red") return false;
    if (filter === "warning" && s.wellbeingTier !== "warning") return false;
    if (filter === "crisis" && !s.hasCrisisFlag) return false;
    if (filter === "alerts" && s.alertCount === 0) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
          {([
            { key: "all", label: "All" },
            { key: "red", label: "Red" },
            { key: "warning", label: "Warning" },
            { key: "crisis", label: "Crisis" },
            { key: "alerts", label: "Alerts" },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn("px-2.5 py-1 rounded text-[10px] font-medium transition",
                filter === f.key ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Student list */}
      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {data.topConcerns.length === 0 ? "No students with concerns. All green!" : "No students match your filter."}
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map(s => (
                <div key={s.studentId} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                    s.wellbeingTier === "red" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" :
                    s.wellbeingTier === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  )}>
                    {s.studentName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{s.studentName}</span>
                      {s.hasCrisisFlag && <Badge variant="outline" className="text-[9px] bg-rose-100 text-rose-700">CRISIS</Badge>}
                      {s.alertCount > 0 && <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700">{s.alertCount} alert{s.alertCount > 1 ? "s" : ""}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.reasons.length > 0 ? s.reasons.join("; ") : `Mood: ${s.moodScore ?? "—"} · Engagement: ${s.engagementScore ?? "—"}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {s.frustrationCount > 0 && <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700">{s.frustrationCount}F</Badge>}
                    {s.avoidanceCount > 0 && <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700">{s.avoidanceCount}A</Badge>}
                    {s.enthusiasmCount > 0 && <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700">{s.enthusiasmCount}E</Badge>}
                    {/* H7 fix: counselors can now open the student's portfolio
                        directly from the caseload — was locked into aggregate views. */}
                    {onStudentClick && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-primary hover:bg-primary/10"
                        onClick={() => onStudentClick(s.studentId, s.studentName)}
                        title={`Open ${s.studentName}'s portfolio`}
                      >
                        Portfolio →
                      </Button>
                    )}
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

// ============================================================
// SESSIONS — GROW touchpoint history + logger + case reviews
// ============================================================
function SessionsView({ data, onNavigateToMessages, onStudentClick }: { data: CounselorData; onNavigateToMessages?: () => void; onStudentClick?: (studentId: string, studentName: string) => void }) {
  return (
    <div className="space-y-4">
      {/* GROW Logger */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Log a GROW Session
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <VoiceTouchpointLogger onLogged={() => {}} />
        </CardContent>
      </Card>

      {/* Recent touchpoints */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentTouchpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sessions logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {data.recentTouchpoints.map(tp => (
                <div key={tp.touchpointId} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{tp.studentName}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px]">{tp.type}</Badge>
                      {tp.outcome && <Badge variant="outline" className={cn("text-[9px]",
                        tp.outcome === "resolved" ? "bg-emerald-50 text-emerald-700" :
                        tp.outcome === "escalated" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                      )}>{tp.outcome}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{timeAgo(tp.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{tp.note}</p>
                  {tp.followUpDate && (
                    <div className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Follow-up: {new Date(tp.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case reviews */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Case Reviews
          </CardTitle>
          <CardDescription className="text-xs">Anonymized patterns for peer consultation</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <CaseReviewPanel />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// PATTERNS — batch-level psych analytics
// ============================================================
function PatternsView({ data }: { data: CounselorData }) {
  const { psychSummary, caseload } = data;

  // Build chart data from psychSummary.byDimension
  const dimensionCharts = Object.entries(psychSummary.byDimension).map(([dim, values]) => ({
    dimension: dim,
    data: Object.entries(values).map(([value, count]) => ({ value, count })),
  }));

  const signalData = [
    { name: "Frustration", value: caseload.totalFrustration, color: "#f97316" },
    { name: "Avoidance", value: caseload.totalAvoidance, color: "#ef4444" },
    { name: "Enthusiasm", value: caseload.totalEnthusiasm, color: "#10b981" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Signal summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Brain} label="Evidence (7d)" value={psychSummary.totalEvidence} color="text-purple-600" />
        <StatCard icon={TrendingDown} label="Frustration" value={caseload.totalFrustration} color="text-orange-600" />
        <StatCard icon={Ban} label="Avoidance" value={caseload.totalAvoidance} color="text-rose-600" />
        <StatCard icon={Sparkles} label="Enthusiasm" value={caseload.totalEnthusiasm} color="text-emerald-600" />
      </div>

      {/* Signal distribution chart */}
      {signalData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Behavioral Signals This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={signalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "12px" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {signalData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-dimension breakdown */}
      {dimensionCharts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              7-Dimension Evidence Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Batch-level psychological patterns from the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dimensionCharts.map(dim => (
                <div key={dim.dimension} className="p-3 rounded-lg border bg-card">
                  <div className="text-xs font-semibold capitalize mb-2">{dim.dimension.replace(/_/g, " ")}</div>
                  <div className="space-y-1">
                    {dim.data.map(d => (
                      <div key={d.value} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground capitalize">{d.value.replace(/_/g, " ")}</span>
                        <Badge variant="secondary" className="text-[9px]">{d.count}</Badge>
                      </div>
                    ))}
                  </div>
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
// Shared components
// ============================================================
function StatCard({ icon: Icon, label, value, subtitle, color }: {
  icon: any; label: string; value: string | number; subtitle?: string; color: string;
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

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

// Re-export Bell icon (used in CommandCenter)
function Bell({ className }: { className?: string }) {
  return <AlertTriangle className={className} />;
}
