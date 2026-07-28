"use client";

/**
 * MentorshipTabV2 — rebuilt with the GROW coaching framework.
 *
 * Based on research on online mentorship best practices:
 * - GROW Model (Whitmore): Goal → Reality → Options → Will
 * - Self-Determination Theory (Deci & Ryan): autonomy, competence, relatedness
 * - Coaching psychology: non-directive, student-led, growth-oriented
 * - Structured mentorship touchpoints with purpose + outcome tracking
 *
 * The tab shows:
 * 1. Active alerts (psych/educational/mentorship) with resolve actions
 * 2. Student health summary (mood, engagement, scores, streak) with trend chart
 * 3. GROW coaching touchpoint logger with coaching categories
 * 4. Touchpoint history with outcomes + follow-up scheduling
 * 5. Quick message button (links to Messages)
 *
 * The instructor sees exactly what the student needs — driven by data, not guessing.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Brain, HeartHandshake, GraduationCap, AlertCircle, CheckCircle2,
  MessageSquare, Plus, Clock, TrendingUp, TrendingDown, Activity,
  Send, X, ChevronDown, ChevronRight, Target, Lightbulb, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioData } from "@/components/examiner/instructor/types";

// GROW coaching touchpoint types
const COACHING_TYPES = [
  { value: "goal_setting", label: "Goal Setting (G)", desc: "What does the student want to achieve? Define a specific, measurable goal.", icon: Target },
  { value: "reality_check", label: "Reality Check (R)", desc: "Where is the student now? Assess current situation honestly.", icon: Activity },
  { value: "options_explore", label: "Explore Options (O)", desc: "What could the student do? Brainstorm approaches without judging.", icon: Lightbulb },
  { value: "will_commit", label: "Will / Commit (W)", desc: "What WILL the student do? Concrete next step + timeline.", icon: CheckCircle2 },
  { value: "checkin", label: "General Check-in", desc: "Routine wellbeing + progress check.", icon: MessageSquare },
  { value: "alert_response", label: "Alert Response", desc: "Responding to a psych/educational/mentorship alert.", icon: AlertCircle },
  { value: "praise_note", label: "Praise / Recognition", desc: "Acknowledge effort or achievement (praise effort, not ability).", icon: HeartHandshake },
  { value: "escalation", label: "Escalation", desc: "Escalate to counselor, principal, or external support.", icon: TrendingUp },
] as const;

const OUTCOMES = [
  { value: "resolved", label: "Resolved", color: "text-emerald-600" },
  { value: "ongoing", label: "Ongoing", color: "text-amber-600" },
  { value: "escalated", label: "Escalated", color: "text-red-600" },
  { value: "scheduled_followup", label: "Follow-up scheduled", color: "text-blue-600" },
] as const;

interface Touchpoint {
  id: string;
  actorUserId: string;
  type: string;
  note: string;
  outcome: string | null;
  followUpDate: string | null;
  createdAt: string;
}

interface StudentAlert {
  id: string;
  type: string;
  severity: string;
  reason: string;
  metric: string;
  metricValue: string;
  status: string;
  createdAt: string;
}

interface HealthSummary {
  moodScore: number;
  engagementScore: number;
  frustrationCount: number;
  avoidanceCount: number;
  enthusiasmCount: number;
  tutorMessagesThisWeek: number;
  tutorMessagesLastWeek: number;
  testsThisWeek: number;
  avgScoreThisWeek: number | null;
  avgScoreLastWeek: number | null;
  engagementStreak: number;
  lastActiveDate: string | null;
  needsPsychAlert: boolean;
  needsEducationalAlert: boolean;
  needsMentorshipAlert: boolean;
}

const alertIcon = (type: string) =>
  type === "psychological" ? Brain
  : type === "educational" ? GraduationCap
  : HeartHandshake;

const alertColor = (type: string) =>
  type === "psychological" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300"
  : type === "educational" ? "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300"
  : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";

const severityColor = (sev: string) =>
  sev === "red" ? "bg-red-500/10 text-red-600 border-red-500/30"
  : "bg-amber-500/10 text-amber-600 border-amber-500/30";

export function MentorshipTabV2({ portfolio, onCompose }: { portfolio: PortfolioData; onCompose: (studentId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [alerts, setAlerts] = useState<StudentAlert[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<string>("checkin");
  const [logNote, setLogNote] = useState("");
  const [logOutcome, setLogOutcome] = useState<string>("");
  const [logFollowUp, setLogFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!portfolio?.student?.id) return;
    setLoading(true);
    Promise.allSettled([
      api.get<{ touchpoints: Touchpoint[] }>(`/api/mentorship/touchpoints?userId=${portfolio.student.id}`),
      api.get<{ alerts: StudentAlert[]; summary: HealthSummary | null }>(`/api/students/alerts?userId=${portfolio.student.id}`),
    ]).then(([tpRes, alRes]) => {
      if (tpRes.status === "fulfilled") setTouchpoints(tpRes.value.touchpoints || []);
      if (alRes.status === "fulfilled") {
        setAlerts(alRes.value.alerts || []);
        setSummary(alRes.value.summary || null);
      }
    }).finally(() => setLoading(false));
  }, [portfolio?.student?.id]);

  useEffect(() => { load(); }, [load]);

  const saveTouchpoint = async () => {
    if (!logNote.trim() || !portfolio?.student?.id) return;
    setSaving(true);
    try {
      await api.post("/api/mentorship/touchpoints", {
        userId: portfolio.student.id,
        type: logType,
        note: logNote.trim(),
        outcome: logOutcome || null,
        followUpDate: logFollowUp || null,
      });
      setShowLogForm(false);
      setLogNote(""); setLogOutcome(""); setLogFollowUp(""); setLogType("checkin");
      load();
    } catch { /* non-blocking */ }
    finally { setSaving(false); }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await api.patch("/api/students/alerts", { alertId, status: "resolved", resolutionNote: "Resolved via mentorship tab" });
      load();
    } catch { /* non-blocking */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const studentName = portfolio?.student?.name || "Student";

  return (
    <div className="space-y-4">
      {/* === ACTIVE ALERTS === */}
      {alerts.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Active Alerts ({alerts.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Data-driven alerts based on the student&apos;s recent activity. Click to expand. Resolve when you&apos;ve taken action.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(alert => {
              const Icon = alertIcon(alert.type);
              const isExpanded = expandedAlert === alert.id;
              return (
                <div key={alert.id} className={cn("rounded-lg border p-3", alertColor(alert.type))}>
                  <button
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium capitalize">{alert.type} alert</p>
                        <p className="text-[10px] opacity-70 truncate">{alert.reason.slice(0, 60)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant="outline" className={cn("text-[9px] capitalize", severityColor(alert.severity))}>{alert.severity}</Badge>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                      <p className="text-xs text-foreground">{alert.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Metric: {alert.metric} = {alert.metricValue}
                        {" · "}Created: {new Date(alert.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={() => resolveAlert(alert.id)} size="sm" variant="outline" className="text-[10px] h-6">
                          <CheckCircle2 className="h-3 w-3" /> Resolve
                        </Button>
                        <Button onClick={() => onCompose(portfolio.student.id)} size="sm" variant="outline" className="text-[10px] h-6">
                          <MessageSquare className="h-3 w-3" /> Message student
                        </Button>
                        <Button onClick={() => { setShowLogForm(true); setLogType("alert_response"); }} size="sm" variant="outline" className="text-[10px] h-6">
                          <ClipboardList className="h-3 w-3" /> Log coaching touchpoint
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* === STUDENT HEALTH SUMMARY === */}
      {summary && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> {studentName}&apos;s Health Overview
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Auto-calculated from tutor conversations + test scores. Updated on every interaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Mood */}
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Mood Score</p>
                <p className={cn("text-xl font-bold", summary.moodScore < 40 ? "text-red-500" : summary.moodScore < 60 ? "text-amber-500" : "text-emerald-500")}>
                  {summary.moodScore}
                </p>
                <p className="text-[9px] text-muted-foreground">/ 100</p>
              </div>
              {/* Engagement */}
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Engagement</p>
                <p className={cn("text-xl font-bold", summary.engagementScore < 40 ? "text-red-500" : summary.engagementScore < 60 ? "text-amber-500" : "text-emerald-500")}>
                  {summary.engagementScore}
                </p>
                <p className="text-[9px] text-muted-foreground">/ 100</p>
              </div>
              {/* Avg Score */}
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Avg Test Score</p>
                <p className={cn("text-xl font-bold", summary.avgScoreThisWeek === null ? "text-muted-foreground" : summary.avgScoreThisWeek < 50 ? "text-red-500" : summary.avgScoreThisWeek < 75 ? "text-amber-500" : "text-emerald-500")}>
                  {summary.avgScoreThisWeek !== null ? `${Math.round(summary.avgScoreThisWeek)}%` : "—"}
                </p>
                <p className="text-[9px] text-muted-foreground">this week</p>
              </div>
              {/* Streak */}
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Engagement Streak</p>
                <p className={cn("text-xl font-bold", summary.engagementStreak === 0 ? "text-red-500" : summary.engagementStreak < 3 ? "text-amber-500" : "text-emerald-500")}>
                  {summary.engagementStreak}
                </p>
                <p className="text-[9px] text-muted-foreground">days</p>
              </div>
            </div>

            {/* Signal counts */}
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.frustrationCount > 0 && (
                <Badge variant="outline" className="text-[9px] bg-red-500/5 text-red-600 border-red-500/20">
                  {summary.frustrationCount} frustration signals this week
                </Badge>
              )}
              {summary.avoidanceCount > 0 && (
                <Badge variant="outline" className="text-[9px] bg-amber-500/5 text-amber-600 border-amber-500/20">
                  {summary.avoidanceCount} avoidance signals this week
                </Badge>
              )}
              {summary.enthusiasmCount > 0 && (
                <Badge variant="outline" className="text-[9px] bg-emerald-500/5 text-emerald-600 border-emerald-500/20">
                  {summary.enthusiasmCount} enthusiasm signals this week
                </Badge>
              )}
              {summary.tutorMessagesThisWeek > 0 && (
                <Badge variant="outline" className="text-[9px] bg-blue-500/5 text-blue-600 border-blue-500/20">
                  {summary.tutorMessagesThisWeek} tutor messages this week
                </Badge>
              )}
              {summary.lastActiveDate && (
                <Badge variant="outline" className="text-[9px] text-muted-foreground">
                  Last active: {new Date(summary.lastActiveDate).toLocaleDateString()}
                </Badge>
              )}
            </div>

            {/* Week-over-week comparison */}
            {summary.avgScoreLastWeek !== null && summary.avgScoreThisWeek !== null && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {summary.avgScoreThisWeek > summary.avgScoreLastWeek ? (
                  <><TrendingUp className="h-3 w-3 text-emerald-500" /> Score improved from {Math.round(summary.avgScoreLastWeek)}% to {Math.round(summary.avgScoreThisWeek)}% this week</>
                ) : (
                  <><TrendingDown className="h-3 w-3 text-red-500" /> Score dropped from {Math.round(summary.avgScoreLastWeek)}% to {Math.round(summary.avgScoreThisWeek)}% this week</>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === GROW COACHING TOUCHPOINTS === */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Coaching Touchpoints
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                GROW model: Goal, Reality, Options, Will. Log every coaching conversation.
              </CardDescription>
            </div>
            <Button onClick={() => setShowLogForm(!showLogForm)} size="sm" variant="outline" className="text-xs">
              {showLogForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showLogForm ? "Cancel" : "Log touchpoint"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Log form */}
          {showLogForm && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
              <div>
                <Label className="text-xs text-foreground">Coaching type (GROW)</Label>
                <Select value={logType} onValueChange={setLogType}>
                  <SelectTrigger className="bg-muted border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COACHING_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {COACHING_TYPES.find(t => t.value === logType)?.desc}
                </p>
              </div>
              <div>
                <Label className="text-xs text-foreground">Notes (what happened, what was discussed)</Label>
                <Textarea
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  className="bg-muted border-border mt-1 min-h-[80px]"
                  placeholder="e.g., Discussed the student's goal of completing the homepage by Friday. They feel overwhelmed by CSS. Explored options: focus on layout first, style later. Student committed to 30 min/day on layout."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-foreground">Outcome</Label>
                  <Select value={logOutcome} onValueChange={setLogOutcome}>
                    <SelectTrigger className="bg-muted border-border mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-foreground">Follow-up date (optional)</Label>
                  <Input
                    type="date"
                    value={logFollowUp}
                    onChange={(e) => setLogFollowUp(e.target.value)}
                    className="bg-muted border-border mt-1"
                  />
                </div>
              </div>
              <Button onClick={saveTouchpoint} disabled={!logNote.trim() || saving} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Save touchpoint
              </Button>
            </div>
          )}

          {/* Touchpoint history */}
          {touchpoints.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              No coaching touchpoints logged yet. Start by clicking &quot;Log touchpoint&quot; above.
            </p>
          ) : (
            touchpoints.map(tp => {
              const coachingType = COACHING_TYPES.find(t => t.value === tp.type);
              const Icon = coachingType?.icon || MessageSquare;
              const outcome = OUTCOMES.find(o => o.value === tp.outcome);
              return (
                <div key={tp.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground">{coachingType?.label || tp.type}</span>
                    {outcome && (
                      <Badge variant="outline" className={cn("text-[9px]", outcome.color)}>{outcome.label}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(tp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90">{tp.note}</p>
                  {tp.followUpDate && (
                    <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> Follow-up: {new Date(tp.followUpDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* === QUICK ACTIONS === */}
      <div className="flex gap-2">
        <Button onClick={() => onCompose(portfolio.student.id)} variant="outline" size="sm" className="text-xs border-border">
          <MessageSquare className="h-3 w-3" /> Send message to {studentName}
        </Button>
        <Button onClick={() => { setShowLogForm(true); setLogType("praise_note"); }} variant="outline" size="sm" className="text-xs border-border">
          <HeartHandshake className="h-3 w-3" /> Log praise
        </Button>
      </div>
    </div>
  );
}
