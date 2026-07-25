"use client";

/**
 * MentorshipView — redesigned for GROW coaching at scale.
 *
 * At 50-100 students, a teacher can't mentor everyone equally. This view
 * prioritizes the students who need coaching most, with:
 *
 * 1. Follow-ups Due — students with scheduled follow-ups coming up
 * 2. Active Alerts — students with open psych/edu/mentorship alerts
 * 3. Caseload — full student list with coaching status
 * 4. GROW Logger — quick touchpoint entry (voice/free-text → AI parsed)
 *
 * Each item has one-click actions: View Portfolio, Resolve Alert, Log Touchpoint.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  HeartHandshake, Clock, Bell, Search, ArrowRight, CheckCircle2,
  AlertCircle, Calendar, Plus, MessageSquare, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { StudentRow } from "@/components/examiner/teacher/types";
import { VoiceTouchpointLogger } from "@/components/examiner/teacher/VoiceTouchpointLogger";
import { CaseReviewPanel } from "@/components/examiner/teacher/CaseReviewPanel";
import { TeacherRulesPanel } from "@/components/examiner/teacher/TeacherRulesPanel";

interface MentorshipViewProps {
  students: StudentRow[];
  alerts: any[];
  onStudentClick: (student: StudentRow) => void;
}

export function MentorshipView({ students, alerts, onStudentClick }: MentorshipViewProps) {
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alerts" | "followups" | "ongoing">("all");

  // Defensive: ensure students is always an array
  const safeStudents = Array.isArray(students) ? students : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Touchpoints will be loaded per-student on demand; for the overview
      // we show alerts + follow-ups from the students data
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build the mentorship queue — students with alerts + follow-ups
  const mentorshipQueue = useMemo(() => {
    const queue: Array<{
      student: StudentRow;
      alerts: any[];
      urgency: number;
      reason: string;
    }> = [];

    safeStudents.forEach(s => {
      const studentAlerts = alerts.filter(a => a.userId === s.id);
      if (studentAlerts.length > 0 || s.needsAttention) {
        const crisisAlerts = studentAlerts.filter(a => a.severity === "red");
        const urgency = crisisAlerts.length > 0 ? 5 : studentAlerts.length > 0 ? 4 : (s.attentionScore || 0) >= 30 ? 3 : 2;
        queue.push({
          student: s,
          alerts: studentAlerts,
          urgency,
          reason: studentAlerts.length > 0
            ? `${studentAlerts.length} alert${studentAlerts.length > 1 ? "s" : ""}: ${studentAlerts.map(a => a.type).join(", ")}`
            : (s.attentionReasons || []).join("; ") || "Needs attention",
        });
      }
    });

    return queue.sort((a, b) => b.urgency - a.urgency);
  }, [safeStudents, alerts]);

  // Filtered list based on search + filter
  const filteredQueue = useMemo(() => {
    let result = mentorshipQueue;
    if (filter === "alerts") result = result.filter(q => q.alerts.length > 0);
    if (filter === "followups") result = result.filter(q => q.student.needsAttention);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item => item.student.name.toLowerCase().includes(q) || item.student.email.toLowerCase().includes(q));
    }
    return result;
  }, [mentorshipQueue, filter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: mentorshipQueue.length,
    crisis: mentorshipQueue.filter(q => q.urgency === 5).length,
    alerts: mentorshipQueue.filter(q => q.alerts.length > 0).length,
    needsAttention: mentorshipQueue.filter(q => q.student.needsAttention).length,
  }), [mentorshipQueue]);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={HeartHandshake} label="Active Cases" value={stats.total} color="text-primary" />
        <StatCard icon={AlertCircle} label="Crisis" value={stats.crisis} color="text-rose-600" />
        <StatCard icon={Bell} label="Open Alerts" value={stats.alerts} color="text-amber-600" />
        <StatCard icon={Clock} label="Need Attention" value={stats.needsAttention} color="text-orange-600" />
      </div>

      {/* GROW Logger — quick touchpoint entry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Log a GROW Coaching Session
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <VoiceTouchpointLogger students={safeStudents} onLogged={load} />
        </CardContent>
      </Card>

      {/* Mentorship Queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-primary" />
              Mentorship Queue
              <Badge variant="secondary" className="text-[10px]">{filteredQueue.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Filter buttons */}
              <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                {([
                  { key: "all", label: "All" },
                  { key: "alerts", label: "Alerts" },
                  { key: "followups", label: "Attention" },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-medium transition",
                      filter === f.key ? "bg-background shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-48"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading mentorship queue...
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No active mentorship cases</p>
              <p className="text-xs text-muted-foreground mt-1">All students are on track. Great work!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredQueue.map(item => (
                <MentorshipRow
                  key={item.student.id}
                  student={item.student}
                  alerts={item.alerts}
                  urgency={item.urgency}
                  reason={item.reason}
                  onClick={() => onStudentClick(item.student)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Review + Rules (collapsible) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Case Review</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CaseReviewPanel />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Automation Rules</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TeacherRulesPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-3.5 h-3.5", color)} />
        </div>
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MentorshipRow({ student, alerts, urgency, reason, onClick }: {
  student: StudentRow;
  alerts: any[];
  urgency: number;
  reason: string;
  onClick: () => void;
}) {
  const urgencyColor = urgency === 5 ? "border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900"
    : urgency === 4 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
    : urgency === 3 ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900"
    : "border-slate-200 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-800";

  return (
    <button
      onClick={onClick}
      className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition hover:shadow-sm", urgencyColor)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">{student.name}</span>
          {urgency === 5 && <Badge variant="outline" className="text-[9px] bg-rose-100 text-rose-700 border-rose-300">CRISIS</Badge>}
          {urgency === 4 && <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700 border-amber-300">ALERT</Badge>}
        </div>
        <div className="text-xs text-muted-foreground truncate">{reason}</div>
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {alerts.slice(0, 3).map(a => (
              <Badge key={a.id} variant="outline" className="text-[9px] px-1 py-0">
                {a.type}: {a.severity}
              </Badge>
            ))}
            {alerts.length > 3 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{alerts.length - 3}</Badge>}
          </div>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
