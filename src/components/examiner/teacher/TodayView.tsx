"use client";

/**
 * TodayView — the teacher's home screen, redesigned for triage at scale.
 *
 * At 50-100 students, a teacher can't read every row. This view is built
 * around 4 questions the teacher asks every morning:
 *
 * 1. "Who needs me RIGHT NOW?" → Triage Queue (crisis, overdue, new alerts)
 * 2. "Is the batch healthy?" → Batch Health Pulse (glanceable stats + distribution)
 * 3. "What changed since yesterday?" → Changes feed (tier changes, new flags, silences)
 * 4. "Any wins to celebrate?" → Wins feed (improvements, praise-worthy moments)
 *
 * Design: color-coded urgency, one-click actions, progressive disclosure.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, HeartHandshake, Clock, TrendingDown, TrendingUp,
  CheckCircle2, ArrowRight, Users, Activity, Zap, Bell, Sparkles,
  Calendar, MessageSquare, AlertCircle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentRow } from "@/components/examiner/teacher/types";

interface TodayViewProps {
  students: StudentRow[];
  stats: any;
  onStudentClick: (student: StudentRow) => void;
  onViewChange: (view: "students" | "messages" | "mentorship") => void;
}

interface TriageItem {
  id: string;
  type: "crisis" | "alert" | "overdue" | "silent" | "message";
  urgency: number; // 1-5, higher = more urgent
  student?: StudentRow;
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string;
  action: () => void;
}

export function TodayView({ students, stats, onStudentClick, onViewChange }: TodayViewProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Defensive: ensure students is always an array
  const safeStudents = Array.isArray(students) ? students : [];

  // Fetch open alerts
  useEffect(() => {
    api.get<{ alerts: any[] }>("/api/students/alerts")
      .then((d) => setAlerts(Array.isArray(d?.alerts) ? d.alerts : []))
      .catch(() => {})
      .finally(() => setLoadingAlerts(false));
  }, []);

  // Build the triage queue — merge crisis, alerts, overdue, silent students
  const triageQueue: TriageItem[] = useMemo(() => {
    const items: TriageItem[] = [];

    // 1. Students needing attention (from stats attentionScore)
    safeStudents.filter(s => s.needsAttention).forEach(s => {
      const hasHighUrgency = (s.attentionScore || 0) >= 40;
      items.push({
        id: `attention-${s.id}`,
        type: hasHighUrgency ? "alert" : "silent",
        urgency: hasHighUrgency ? 5 : 3,
        student: s,
        title: hasHighUrgency ? "Needs immediate attention" : "Showing warning signs",
        description: (s.attentionReasons || []).join("; ") || "Multiple signals flagged",
        timestamp: s.lastActive || "",
        actionLabel: "View Portfolio",
        action: () => onStudentClick(s),
      });
    });

    // 2. Open alerts (from /api/students/alerts)
    alerts.forEach(a => {
      const student = safeStudents.find(s => s.id === a.userId);
      if (!student) return;
      const isCrisis = a.severity === "red";
      items.push({
        id: `alert-${a.id}`,
        type: isCrisis ? "crisis" : "alert",
        urgency: isCrisis ? 5 : 4,
        student,
        title: isCrisis ? `Crisis alert: ${a.type}` : `Alert: ${a.type}`,
        description: a.reason || `${a.metric} = ${a.metricValue}`,
        timestamp: a.createdAt,
        actionLabel: "Review & Resolve",
        action: () => onStudentClick(student),
      });
    });

    // 3. Silent students (no activity in 3+ days, not already flagged)
    const threeDaysAgo = Date.now() - 3 * 86400000;
    safeStudents.forEach(s => {
      if (s.needsAttention) return; // already in the queue
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
          actionLabel: "Send Message",
          action: () => onViewChange("messages"),
        });
      }
    });

    // Sort by urgency (desc), then by timestamp (most recent first)
    return items.sort((a, b) => {
      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [students, alerts, onStudentClick, onViewChange]);

  // Batch health pulse — compute distribution
  const healthPulse = useMemo(() => {
    const total = safeStudents.length || 1;
    const needingAttention = safeStudents.filter(s => s.needsAttention).length;
    const onTrack = total - needingAttention;
    const withProjects = safeStudents.filter(s => s.hasProject).length;
    const activeToday = safeStudents.filter(s => {
      if (!s.lastActive) return false;
      return new Date(s.lastActive).getTime() > Date.now() - 86400000;
    }).length;
    const avgScore = safeStudents.reduce((sum, s) => sum + (s.latestScore || 0), 0) / (safeStudents.filter(s => s.latestScore != null).length || 1);
    return {
      total,
      onTrack,
      needingAttention,
      attentionPct: Math.round((needingAttention / total) * 100),
      withProjects,
      activeToday,
      activePct: Math.round((activeToday / total) * 100),
      avgScore: Math.round(avgScore),
    };
  }, [safeStudents]);

  // Wins — students with improving scores or high performance
  const wins = useMemo(() => {
    return safeStudents
      .filter(s => (s.latestScore || 0) >= 85 && !s.needsAttention)
      .slice(0, 5)
      .map(s => ({
        student: s,
        title: `Scored ${s.latestScore}% on latest test`,
        description: "Top performer — consider for peer mentoring",
      }));
  }, [safeStudents]);

  const crisisItems = triageQueue.filter(i => i.type === "crisis");
  const alertItems = triageQueue.filter(i => i.type === "alert");
  const silentItems = triageQueue.filter(i => i.type === "silent");

  return (
    <div className="space-y-4">
      {/* ============================================ */}
      {/* BATCH HEALTH PULSE — glanceable summary */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthPulseCard
          icon={Users}
          label="Total Students"
          value={healthPulse.total}
          subtitle={`${healthPulse.withProjects} with projects`}
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
          subtitle={healthPulse.avgScore >= 70 ? "Above target" : "Below target"}
          color={healthPulse.avgScore >= 70 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      {/* ============================================ */}
      {/* TRIAGE QUEUE — the #1 priority */}
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
            {triageQueue.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onViewChange("students")}>
                View all students <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingAlerts ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading triage items...</div>
          ) : triageQueue.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No students need immediate attention right now.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {/* Crisis items first */}
              {crisisItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Crisis ({crisisItems.length})
                  </div>
                  {crisisItems.map(item => (
                    <TriageRow key={item.id} item={item} onStudentClick={onStudentClick} />
                  ))}
                </div>
              )}

              {/* Alerts */}
              {alertItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-amber-600 font-bold flex items-center gap-1 mt-3">
                    <Bell className="w-3 h-3" /> Alerts ({alertItems.length})
                  </div>
                  {alertItems.map(item => (
                    <TriageRow key={item.id} item={item} onStudentClick={onStudentClick} />
                  ))}
                </div>
              )}

              {/* Silent students */}
              {silentItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1 mt-3">
                    <Clock className="w-3 h-3" /> Silent ({silentItems.length})
                  </div>
                  {silentItems.slice(0, 10).map(item => (
                    <TriageRow key={item.id} item={item} onStudentClick={onStudentClick} />
                  ))}
                  {silentItems.length > 10 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onViewChange("students")}>
                      +{silentItems.length - 10} more silent students
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* TWO-COLUMN: WINS + QUICK ACTIONS */}
      {/* ============================================ */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Wins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Wins to Celebrate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {wins.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No wins to highlight yet. Students scoring 85%+ will appear here.
              </div>
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
                      <div className="text-xs text-muted-foreground truncate">{w.title}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              <QuickAction
                icon={Users}
                label="View All Students"
                description={`${safeStudents.length} in batch`}
                onClick={() => onViewChange("students")}
              />
              <QuickAction
                icon={HeartHandshake}
                label="Mentorship Queue"
                description={`${alerts.length} alerts open`}
                onClick={() => onViewChange("mentorship")}
              />
              <QuickAction
                icon={MessageSquare}
                label="Messages"
                description="Compose / inbox"
                onClick={() => onViewChange("messages")}
              />
              <QuickAction
                icon={Calendar}
                label="Assignments"
                description="Group tasks + events"
                onClick={() => onViewChange("mentorship")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
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

function TriageRow({ item, onStudentClick }: { item: TriageItem; onStudentClick: (s: StudentRow) => void }) {
  const colorMap = {
    crisis: "border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900",
    alert: "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900",
    silent: "border-slate-200 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-800",
    overdue: "border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900",
    message: "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900",
  };
  const iconMap = {
    crisis: AlertCircle,
    alert: Bell,
    silent: Clock,
    overdue: Clock,
    message: MessageSquare,
  };
  const Icon = iconMap[item.type];

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border", colorMap[item.type])}>
      <Icon className={cn("w-5 h-5 flex-shrink-0", item.type === "crisis" ? "text-rose-600" : item.type === "alert" ? "text-amber-600" : "text-slate-500")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.student?.name || "Unknown"}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0">{item.title}</Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</div>
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

function QuickAction({ icon: Icon, label, description, onClick }: {
  icon: any;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
    >
      <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}
