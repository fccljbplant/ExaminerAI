"use client";

/**
 * PrincipalDashboard — institution administrator for 10000 students + 100 teachers.
 *
 * SEPARATE from AdminDashboard (system-level). Principal is institution-scoped:
 * - Sees ONLY their institution's data
 * - Manages teachers, courses, batches, students
 * - Monitors institution-wide wellbeing + academic performance
 * - Reviews audit logs + growth reports
 * - NO system-level controls (AI config, feature flags, password resets)
 *
 * 4 views:
 * - Overview: institution-wide stats + charts + alerts
 * - Academic: course performance + teacher performance
 * - Wellbeing: wellbeing distribution + psych signals + crisis flags
 * - Audit: audit log + growth reports
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, GraduationCap, BookOpen, AlertTriangle, Heart, Activity,
  TrendingUp, TrendingDown, ShieldCheck, FileText, BarChart3, Brain,
  RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock, Building2,
  Zap, Award, ChevronRight, Brain as BrainIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProminentTabs } from "@/components/shared/prominent-tabs";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar, AreaChart, Area,
} from "recharts";

interface PrincipalData {
  institution: { name: string; logoUrl: string | null; contactEmail: string } | null;
  overview: {
    totalStudents: number; totalTeachers: number; totalCounselors: number; totalMentors: number;
    totalCourses: number; totalBatches: number; totalEnrollments: number;
    totalAlerts: number; openAlerts: number; crisisFlags: number; mentorSessions: number;
    avgMood: number; avgEngagement: number; totalFrustration: number; totalAvoidance: number; totalEnthusiasm: number;
  };
  wellbeing: { green: number; amber: number; red: number };
  alerts: {
    open: number; acknowledged: number; resolved: number; crisis: number; high: number;
    byType: { psychological: number; educational: number; mentorship: number };
  };
  coursePerformance: Array<{ id: string; code: string; name: string; teacher: string; studentCount: number; avgScore: number }>;
  teacherPerformance: Array<{ id: string; name: string; email: string; courses: number; sessions: number; alertsRaised: number }>;
  auditLogs: Array<{ id: string; actorName: string; actorRole: string; action: string; targetType: string; metadata: string | null; createdAt: string }>;
  growthReports: Array<{ id: string; title: string; userName: string; generatedAt: string }>;
}

type PrincipalTab = "overview" | "academic" | "wellbeing" | "audit";

export default function PrincipalDashboard() {
  const [data, setData] = useState<PrincipalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<PrincipalTab>("overview");

  const load = useCallback(async () => {
    try {
      const res = await api.get<PrincipalData>("/api/principal/overview");
      setData(res);
    } catch {
      // silent
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
          <p className="text-sm text-muted-foreground">Unable to load institution overview.</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const TABS: Array<{ key: PrincipalTab; label: string; icon: any; badge?: number; badgeColor?: "amber" | "red" }> = [
    { key: "overview", label: "Overview", icon: BarChart3, badge: data.overview.openAlerts || undefined, badgeColor: "amber" as const },
    { key: "academic", label: "Academic", icon: GraduationCap },
    { key: "wellbeing", label: "Wellbeing", icon: Heart, badge: data.overview.crisisFlags || undefined, badgeColor: "red" as const },
    { key: "audit", label: "Audit Log", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {data.institution?.logoUrl && (
            <img src={data.institution.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white border" />
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.institution?.name || "Institution Dashboard"}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{data.overview.totalStudents} students</Badge>
              <Badge variant="outline" className="text-xs"><GraduationCap className="w-3 h-3 mr-1" />{data.overview.totalTeachers} teachers</Badge>
              <Badge variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />{data.overview.totalCourses} courses</Badge>
              {data.overview.openAlerts > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3 mr-1" />{data.overview.openAlerts} open alerts
                </Badge>
              )}
              {data.overview.crisisFlags > 0 && (
                <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300">
                  {data.overview.crisisFlags} crisis flags
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <ProminentTabs
        tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon, badge: t.badge, badgeColor: t.badgeColor }))}
        active={tab}
        onChange={(k) => setTab(k as PrincipalTab)}
        variant="pill"
        size="md"
      />

      {tab === "overview" && <OverviewView data={data} />}
      {tab === "academic" && <AcademicView data={data} />}
      {tab === "wellbeing" && <WellbeingView data={data} />}
      {tab === "audit" && <AuditView data={data} />}
    </div>
  );
}

// ============================================================
// OVERVIEW — institution-wide stats + charts
// ============================================================
function OverviewView({ data }: { data: PrincipalData }) {
  const { overview, wellbeing, alerts } = data;
  const wellbeingData = [
    { name: "Green", value: wellbeing.green, color: "#10b981" },
    { name: "Amber", value: wellbeing.amber, color: "#f59e0b" },
    { name: "Red", value: wellbeing.red, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const alertData = [
    { name: "Open", value: alerts.open, color: "#ef4444" },
    { name: "Acknowledged", value: alerts.acknowledged, color: "#f59e0b" },
    { name: "Resolved", value: alerts.resolved, color: "#10b981" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* 6 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Students" value={overview.totalStudents} color="text-blue-600" />
        <StatCard icon={GraduationCap} label="Teachers" value={overview.totalTeachers} color="text-emerald-600" />
        <StatCard icon={BookOpen} label="Courses" value={overview.totalCourses} color="text-purple-600" />
        <StatCard icon={Heart} label="Mentor Sessions" value={overview.mentorSessions} color="text-amber-600" />
        <StatCard icon={AlertTriangle} label="Open Alerts" value={overview.openAlerts} color="text-rose-600" />
        <StatCard icon={AlertCircle} label="Crisis Flags" value={overview.crisisFlags} color="text-red-600" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Wellbeing distribution */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Wellbeing Distribution</CardTitle></CardHeader>
          <CardContent>
            {wellbeingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={wellbeingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {wellbeingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No data</p>}
          </CardContent>
        </Card>

        {/* Alert status */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Alert Resolution</CardTitle></CardHeader>
          <CardContent>
            {alertData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={alertData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {alertData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No alerts</p>}
          </CardContent>
        </Card>

        {/* Mood + Engagement */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Institution Mood</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Avg Mood</span>
                  <span className={cn("text-sm font-bold", overview.avgMood >= 60 ? "text-emerald-600" : "text-amber-600")}>{overview.avgMood}/100</span>
                </div>
                <Progress value={overview.avgMood} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Avg Engagement</span>
                  <span className={cn("text-sm font-bold", overview.avgEngagement >= 60 ? "text-emerald-600" : "text-amber-600")}>{overview.avgEngagement}/100</span>
                </div>
                <Progress value={overview.avgEngagement} className="h-2" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <div className="text-lg font-bold text-orange-600">{overview.totalFrustration}</div>
                  <div className="text-[10px] text-muted-foreground">Frustration</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20">
                  <div className="text-lg font-bold text-rose-600">{overview.totalAvoidance}</div>
                  <div className="text-[10px] text-muted-foreground">Avoidance</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-lg font-bold text-emerald-600">{overview.totalEnthusiasm}</div>
                  <div className="text-[10px] text-muted-foreground">Enthusiasm</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// ACADEMIC — course + teacher performance
// ============================================================
function AcademicView({ data }: { data: PrincipalData }) {
  return (
    <div className="space-y-4">
      {/* Course performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Course Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.coursePerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No courses yet.</p>
          ) : (
            <div className="space-y-2">
              {data.coursePerformance.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <Badge variant="outline" className="text-[9px] font-mono">{c.code}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Teacher: {c.teacher} · {c.studentCount} students</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn("text-lg font-bold", c.avgScore >= 70 ? "text-emerald-600" : c.avgScore >= 50 ? "text-amber-600" : "text-rose-600")}>
                      {c.avgScore}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">avg score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> Teacher Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.teacherPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No teachers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-2">Teacher</th>
                    <th className="text-center p-2">Courses</th>
                    <th className="text-center p-2">Sessions</th>
                    <th className="text-center p-2">Alerts Raised</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teacherPerformance.map(t => (
                    <tr key={t.id} className="border-b hover:bg-accent/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{t.name}</span>
                        </div>
                      </td>
                      <td className="text-center p-2 text-xs">{t.courses}</td>
                      <td className="text-center p-2 text-xs">{t.sessions}</td>
                      <td className="text-center p-2"><Badge variant="outline" className="text-[9px]">{t.alertsRaised}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// WELLBEING — institution-wide psychological health
// ============================================================
function WellbeingView({ data }: { data: PrincipalData }) {
  const { wellbeing, alerts, overview } = data;
  const signalData = [
    { name: "Frustration", value: overview.totalFrustration, color: "#f97316" },
    { name: "Avoidance", value: overview.totalAvoidance, color: "#ef4444" },
    { name: "Enthusiasm", value: overview.totalEnthusiasm, color: "#10b981" },
  ].filter(d => d.value > 0);

  const alertTypeData = [
    { name: "Psychological", value: alerts.byType.psychological, color: "#8b5cf6" },
    { name: "Educational", value: alerts.byType.educational, color: "#3b82f6" },
    { name: "Mentorship", value: alerts.byType.mentorship, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label="Green Tier" value={wellbeing.green} color="text-emerald-600" />
        <StatCard icon={AlertTriangle} label="Amber Tier" value={wellbeing.amber} color="text-amber-600" />
        <StatCard icon={AlertCircle} label="Red Tier" value={wellbeing.red} color="text-rose-600" />
        <StatCard icon={ShieldCheck} label="Crisis Flags" value={overview.crisisFlags} color="text-red-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Behavioral Signals</CardTitle></CardHeader>
          <CardContent>
            {signalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={signalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>{signalData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No signals</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Alerts by Type</CardTitle></CardHeader>
          <CardContent>
            {alertTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={alertTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {alertTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-8">No alerts</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// AUDIT — audit log + growth reports
// ============================================================
function AuditView({ data }: { data: PrincipalData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Audit Log
          </CardTitle>
          <CardDescription className="text-xs">Last 20 actions across the institution</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {data.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No audit logs yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {data.auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg border bg-card">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs">
                      <strong>{log.actorName}</strong>
                      <span className="text-muted-foreground"> · {log.action}</span>
                      <span className="text-muted-foreground"> {log.targetType}</span>
                    </div>
                    {log.metadata && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{log.metadata}</div>}
                    <div className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.growthReports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Growth Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.growthReports.map(r => (
                <div key={r.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.userName}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.generatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.title}</p>
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
// Shared
// ============================================================
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
        <div className={cn("text-xl font-bold", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}
