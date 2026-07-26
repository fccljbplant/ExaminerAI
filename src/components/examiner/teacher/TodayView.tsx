"use client";

/**
 * TodayView — the teacher's command center for 100 students.
 *
 * Receives students + stats + alerts as props (no refetching).
 *
 * Sections:
 * 1. Batch Health Pulse — 4 glanceable stat cards with progress bars
 * 2. Triage Queue — urgency-sorted: Crisis → Alerts → Silent → Blocked → Plagiarism
 * 3. Wins to Celebrate — top performers + most improved
 * 4. AI Assistant — free-text Q&A about the batch
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, HeartHandshake, Clock, TrendingDown, TrendingUp,
  CheckCircle2, ArrowRight, Users, Activity, Zap, Bell, Sparkles,
  Calendar, MessageSquare, AlertCircle, ChevronRight, Ban, FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentRow } from "@/components/examiner/teacher/types";
import { TeacherLoadPanel } from "@/components/examiner/teacher/TeacherLoadPanel";

interface TodayViewProps {
  students: StudentRow[];
  stats: any;
  alerts: any[];
  onStudentClick: (student: StudentRow) => void;
  onViewChange: (view: "students" | "messages" | "mentorship") => void;
}

interface TriageItem {
  id: string;
  type: "crisis" | "alert" | "silent" | "blocked" | "plagiarism";
  urgency: number;
  student?: StudentRow;
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string;
  action: () => void;
}

export function TodayView({ students, stats, alerts, onStudentClick, onViewChange }: TodayViewProps) {
  const safeStudents = Array.isArray(students) ? students : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  // Build the triage queue — merge all signals
  const triageQueue: TriageItem[] = useMemo(() => {
    const items: TriageItem[] = [];

    // 1. Open alerts (crisis + non-crisis)
    safeAlerts.forEach(a => {
      const student = safeStudents.find(s => s.id === a.userId);
      if (!student) return;
      const isCrisis = a.severity === "red";
      items.push({
        id: `alert-${a.id}`,
        type: isCrisis ? "crisis" : "alert",
        urgency: isCrisis ? 5 : 4,
        student,
        title: isCrisis ? `Crisis: ${a.type}` : `Alert: ${a.type}`,
        description: a.reason || `${a.metric} = ${a.metricValue}`,
        timestamp: a.createdAt,
        actionLabel: "Review",
        action: () => onStudentClick(student),
      });
    });

    // 2. Students needing attention (from stats attentionScore)
    safeStudents.filter(s => s.needsAttention && !safeAlerts.find(a => a.userId === s.id)).forEach(s => {
      items.push({
        id: `attention-${s.id}`,
        type: "silent",
        urgency: (s.attentionScore || 0) >= 40 ? 4 : 3,
        student: s,
        title: (s.attentionScore || 0) >= 40 ? "High attention score" : "Showing warning signs",
        description: (s.attentionReasons || []).join("; ") || "Multiple signals flagged",
        timestamp: s.lastActive || "",
        actionLabel: "View",
        action: () => onStudentClick(s),
      });
    });

    // 3. Silent students (3+ days inactive, not already flagged)
    const threeDaysAgo = Date.now() - 3 * 86400000;
    safeStudents.forEach(s => {
      if (s.needsAttention) return;
      if (!s.lastActive) return;
      const lastActive = new Date(s.lastActive).getTime();
      if (lastActive < threeDaysAgo) {
        const days = Math.floor((Date.now() - lastActive) / 86400000);
        items.push({
          id: `silent-${s.id}`,
          type: "silent",
          urgency: 2,
          student: s,
          title: `Silent for ${days} days`,
          description: "No recent activity. Consider a check-in.",
          timestamp: s.lastActive,
          actionLabel: "Message",
          action: () => onViewChange("messages"),
        });
      }
    });

    // 4. Blocked tasks (students with blockedTasks > 0)
    safeStudents.forEach(s => {
      const blocked = (s as any).blockedTasks || 0;
      if (blocked > 0 && !items.find(i => i.student?.id === s.id)) {
        items.push({
          id: `blocked-${s.id}`,
          type: "blocked",
          urgency: 3,
          student: s,
          title: `${blocked} blocked task${blocked > 1 ? "s" : ""}`,
          description: "Student is stuck — may need help unblocking.",
          timestamp: s.lastActive || "",
          actionLabel: "View",
          action: () => onStudentClick(s),
        });
      }
    });

    // Sort by urgency (desc), then by timestamp (most recent first)
    return items.sort((a, b) => {
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [safeStudents, safeAlerts, onStudentClick, onViewChange]);

  // Batch health pulse
  const healthPulse = useMemo(() => {
    const total = safeStudents.length || 1;
    const needingAttention = safeStudents.filter(s => s.needsAttention).length;
    const activeToday = safeStudents.filter(s => {
      if (!s.lastActive) return false;
      return new Date(s.lastActive).getTime() > Date.now() - 86400000;
    }).length;
    const scoredStudents = safeStudents.filter(s => s.latestScore != null);
    const avgScore = scoredStudents.length > 0
      ? scoredStudents.reduce((sum, s) => sum + (s.latestScore || 0), 0) / scoredStudents.length
      : 0;
    const withoutProjects = stats?.studentsWithoutProjects || 0;
    return {
      total,
      needingAttention,
      attentionPct: Math.round((needingAttention / total) * 100),
      activeToday,
      activePct: Math.round((activeToday / total) * 100),
      avgScore: Math.round(avgScore),
      scoredCount: scoredStudents.length,
      withoutProjects,
    };
  }, [safeStudents, stats]);

  // Wins — top performers + most improved
  const wins = useMemo(() => {
    return safeStudents
      .filter(s => (s.latestScore || 0) >= 85 && !s.needsAttention)
      .slice(0, 5)
      .map(s => ({
        student: s,
        title: `Scored ${s.latestScore}%`,
        description: "Top performer — consider for peer mentoring",
      }));
  }, [safeStudents]);

  const crisisItems = triageQueue.filter(i => i.type === "crisis");
  const alertItems = triageQueue.filter(i => i.type === "alert");
  const silentItems = triageQueue.filter(i => i.type === "silent");
  const blockedItems = triageQueue.filter(i => i.type === "blocked");

  return (
    <div className="space-y-4">
      {/* H10 fix: Teacher Load + Wellbeing panel — was completely disconnected
          (the /api/teacher/load endpoint existed but no UI consumed it). */}
      <TeacherLoadPanel />

      {/* ============================================ */}
      {/* BATCH HEALTH PULSE */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthPulseCard
          icon={Users}
          label="Total Students"
          value={healthPulse.total}
          subtitle={`${healthPulse.withoutProjects} no project yet`}
          color="text-blue-600"
        />
        <HealthPulseCard
          icon={Activity}
          label="Active Today"
          value={healthPulse.activeToday}
          subtitle={`${healthPulse.activePct}% engagement`}
          color="text-emerald-600"
          progress={healthPulse.activePct}
        />
        <HealthPulseCard
          icon={AlertTriangle}
          label="Need Attention"
          value={healthPulse.needingAttention}
          subtitle={`${healthPulse.attentionPct}% of batch`}
          color={healthPulse.needingAttention > 10 ? "text-rose-600" : "text-amber-600"}
          progress={healthPulse.attentionPct}
          progressColor={healthPulse.needingAttention > 10 ? "bg-rose-500" : "bg-amber-500"}
        />
        <HealthPulseCard
          icon={TrendingUp}
          label="Avg Score"
          value={`${healthPulse.avgScore}%`}
          subtitle={`${healthPulse.scoredCount} tested`}
          color={healthPulse.avgScore >= 70 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      {/* Pending approvals banner */}
      {stats?.pendingApprovals > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              {stats.pendingApprovals} student{stats.pendingApprovals > 1 ? "s" : ""} pending approval
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => onViewChange("students")}>
            Review <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* ============================================ */}
      {/* TRIAGE QUEUE */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Triage Queue
              {triageQueue.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{triageQueue.length}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {triageQueue.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No students need immediate attention right now.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {crisisItems.length > 0 && (
                <TriageGroup label="Crisis" icon={AlertCircle} color="text-rose-600" items={crisisItems} onStudentClick={onStudentClick} />
              )}
              {alertItems.length > 0 && (
                <TriageGroup label="Alerts" icon={Bell} color="text-amber-600" items={alertItems} onStudentClick={onStudentClick} />
              )}
              {blockedItems.length > 0 && (
                <TriageGroup label="Blocked Tasks" icon={Ban} color="text-orange-600" items={blockedItems} onStudentClick={onStudentClick} />
              )}
              {silentItems.length > 0 && (
                <TriageGroup label="Silent / Warning Signs" icon={Clock} color="text-slate-500" items={silentItems.slice(0, 10)} onStudentClick={onStudentClick} />
              )}
              {silentItems.length > 10 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onViewChange("students")}>
                  +{silentItems.length - 10} more — view all students
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* WINS */}
      {/* ============================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Wins to Celebrate
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {wins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No wins to highlight yet. Students scoring 85%+ will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {wins.map(w => (
                <button
                  key={w.student.id}
                  onClick={() => onStudentClick(w.student)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.student.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{w.title} — {w.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function HealthPulseCard({ icon: Icon, label, value, subtitle, color, progress, progressColor }: {
  icon: any;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-3.5 h-3.5", color || "text-muted-foreground")} />
        </div>
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
        {progress !== undefined && (
          <Progress value={progress} className={cn("h-1 mt-2", progressColor)} />
        )}
      </CardContent>
    </Card>
  );
}

function TriageGroup({ label, icon: Icon, color, items, onStudentClick }: {
  label: string;
  icon: any;
  color: string;
  items: TriageItem[];
  onStudentClick: (s: StudentRow) => void;
}) {
  return (
    <div className="space-y-2">
      <div className={cn("text-[10px] uppercase tracking-wider font-bold flex items-center gap-1", color)}>
        <Icon className="w-3 h-3" /> {label} ({items.length})
      </div>
      {items.map(item => (
        <TriageRow key={item.id} item={item} onStudentClick={onStudentClick} />
      ))}
    </div>
  );
}

function TriageRow({ item, onStudentClick }: { item: TriageItem; onStudentClick: (s: StudentRow) => void }) {
  const colorMap = {
    crisis: "border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900",
    alert: "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900",
    silent: "border-slate-200 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-800",
    blocked: "border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900",
    plagiarism: "border-purple-300 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-900",
  };
  const iconMap = {
    crisis: AlertCircle,
    alert: Bell,
    silent: Clock,
    blocked: Ban,
    plagiarism: FileWarning,
  };
  const Icon = iconMap[item.type];

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border", colorMap[item.type])}>
      <Icon className={cn("w-5 h-5 flex-shrink-0", item.type === "crisis" ? "text-rose-600" : item.type === "alert" ? "text-amber-600" : item.type === "blocked" ? "text-orange-600" : "text-slate-500")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.student?.name || "Unknown"}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 whitespace-nowrap">{item.title}</Badge>
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</div>
      </div>
      <Button
        size="sm"
        variant={item.type === "crisis" ? "default" : "outline"}
        className="text-xs h-7 flex-shrink-0"
        onClick={item.action}
      >
        {item.actionLabel}
      </Button>
    </div>
  );
}
