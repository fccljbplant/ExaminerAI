"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import type { PortfolioData } from "@/components/examiner/teacher/types";
import { CalibrationScatterCard } from "@/components/examiner/teacher/CalibrationScatterCard";

export function PsychologicalTab({ portfolio }: { portfolio: PortfolioData }) {
  const c = useChartColors();
  const [evidence, setEvidence] = useState<{ id: string; dimension: string; value: string; evidenceText: string; sourceType: string; sourceId: string | null; week: number | null; createdAt: string }[]>([]);
  const [wellbeingState, setWellbeingState] = useState<{ tier: string; reasonsJson: string; updatedAt: string } | null>(null);
  const [crisisFlags, setCrisisFlags] = useState<{ id: string; category: string; severity: string; status: string; createdAt: string; resolvedAt: string | null }[]>([]);
  const [confidenceRatings, setConfidenceRatings] = useState<{ id: string; source: string; rating: number; actualScore: number | null; context: string | null; week: number | null; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  // P1.1: Crisis flag creation state
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagCategory, setFlagCategory] = useState("behavioral_concern");
  const [flagSeverity, setFlagSeverity] = useState<"amber" | "red">("amber");
  const [flagBusy, setFlagBusy] = useState(false);

  useEffect(() => {
    if (!portfolio?.student?.id) return;
    const studentId = portfolio.student.id;
    setLoading(true);
    Promise.allSettled([
      api.get<{ evidence: typeof evidence }>(`/api/psych-evidence?userId=${studentId}`),
      api.get<{ state: typeof wellbeingState }>(`/api/wellbeing-state?userId=${studentId}`),
      api.get<{ flags: typeof crisisFlags }>(`/api/crisis-flags?userId=${studentId}`),
      api.get<{ ratings: typeof confidenceRatings }>(`/api/confidence-ratings?userId=${studentId}`),
    ]).then(([evRes, wsRes, cfRes, crRes]) => {
      if (evRes.status === "fulfilled") setEvidence(evRes.value.evidence || []);
      if (wsRes.status === "fulfilled") setWellbeingState(wsRes.value.state);
      if (cfRes.status === "fulfilled") setCrisisFlags(cfRes.value.flags || []);
      if (crRes.status === "fulfilled") setConfidenceRatings(crRes.value.ratings || []);
    }).finally(() => setLoading(false));
  }, [portfolio?.student?.id]);

  // Group evidence by dimension
  const evidenceByDimension = evidence.reduce<Record<string, typeof evidence>>((acc, e) => {
    if (!acc[e.dimension]) acc[e.dimension] = [];
    acc[e.dimension].push(e);
    return acc;
  }, {});

  // 7 dimensions per spec — each with explanation + value meanings for the teacher
  const DIMENSIONS = [
    {
      key: "calibration",
      label: "Calibration",
      hint: "Does the student know what they know?",
      explanation: "Measures the gap between self-rated confidence and actual performance. Collected from confidence self-ratings on daily tests.",
      valueMeanings: {
        "overconfident": "Student rated themselves high but scored low. They may not realize they don't understand. Action: show them their wrong answers and ask them to explain why.",
        "underconfident": "Student rated themselves low but scored high. They know more than they think. Action: show them what they got right, build confidence with specific praise.",
        "well-calibrated": "Student's confidence matches their performance. Healthy self-awareness. Action: continue as-is, introduce slightly harder challenges.",
        "no_self_rating": "This test type doesn't collect confidence data (weekly/practice tests). Only daily tests collect self-ratings.",
      }
    },
    {
      key: "explanatory_depth",
      label: "Explanatory Depth",
      hint: "How deeply does the student explain their reasoning?",
      explanation: "Measures answer detail from average character length in the conversation. Not about being verbose — about showing reasoning.",
      valueMeanings: {
        "surface_answers": "Very short answers (under 50 characters). May indicate rushing, anxiety, or gaps. Action: probe with 'Can you explain why?'",
        "moderate_depth": "Adequate explanations (50-300 characters). The student can explain but doesn't go deep without prompting. Action: ask follow-up questions to push deeper.",
        "detailed_reasoning": "Step-by-step explanations (over 300 characters). Strong signal — the student is connecting concepts, not just reciting. Action: introduce advanced applications.",
      }
    },
    {
      key: "gaming_pattern",
      label: "Gaming Pattern",
      hint: "Is the student using AI to generate answers?",
      explanation: "Detects voice inconsistency — when some answers sound very different from others (a sign of copy-pasting from ChatGPT).",
      valueMeanings: {
        "authentic_voice": "Consistent voice across all answers. No signs of AI assistance. The student's work is their own.",
        "voice_inconsistency": "Significant voice differences detected. Some answers may be AI-generated. Action: ask the student to explain their answer verbally in a 1-on-1.",
        "not_analyzed": "This test type doesn't run plagiarism analysis (practice tests). Weekly tests run the full analysis.",
      }
    },
    {
      key: "attribution",
      label: "Attribution / Mindset",
      hint: "Growth vs. fixed mindset signals",
      explanation: "Detects language patterns: growth-mindset ('learn', 'practice', 'improve') vs. fixed-mindset ('can't', 'not good at'). Also checks for avoidance ('I don't know', 'skip').",
      valueMeanings: {
        "growth_mindset": "Student uses effort-based language ('I can learn this', 'I need more practice'). Responds well to challenges. Action: give them harder problems.",
        "fixed_mindset": "Student uses ability-based language ('I'm not good at this', 'I can't do it'). May avoid challenges. Action: praise effort, not ability. Say 'you worked hard on this' not 'you're smart'.",
        "avoidant": "Multiple 'I don't know' or 'skip' answers. May indicate anxiety, lack of preparation, or fear of being wrong. Action: create a safe space for wrong answers, ask easier questions first.",
        "neutral": "No strong mindset signals in this test. The student engaged normally.",
      }
    },
    {
      key: "cognitive_load",
      label: "Cognitive Load",
      hint: "How hard is the material for this student right now?",
      explanation: "Inferred from test score. High load is NOT bad — it's where learning happens. But sustained high load without support leads to burnout.",
      valueMeanings: {
        "high_intrinsic": "Score below 40%. The material is too difficult right now. Action: break into smaller pieces, provide prerequisites, slow down.",
        "moderate_load": "Score 40-89%. The student is engaging with the material but hasn't mastered it yet. This is the sweet spot for learning. Action: continue at this pace, provide practice.",
        "low_germane": "Score 90%+. Material mastered, low cognitive load. The student is ready for advanced or applied work. Action: introduce harder challenges or real-world projects.",
      }
    },
    {
      key: "srl_phase",
      label: "SRL Phase",
      hint: "Where is the student in the self-regulated learning cycle?",
      explanation: "Infers the student's learning phase from answer patterns. Self-Regulated Learning has three phases: forethought (planning), performance (doing), reflection (reviewing).",
      valueMeanings: {
        "forethought": "Student is still building familiarity. Short, tentative answers. Action: provide clear instructions and examples before asking questions.",
        "performance": "Student is actively working at a steady pace. Moderate-length answers. Action: let them work, provide feedback on process not just answers.",
        "reflection": "Student is deeply processing, connecting concepts. Long, detailed answers. Action: ask them to teach the concept to someone else — this deepens understanding.",
        "performance_with_fatigue": "Student started strong but shortened over time. May be tired or losing focus. Action: consider shorter sessions, check if the workload is too heavy.",
      }
    },
    {
      key: "fluency",
      label: "Fluency / Retention",
      hint: "How stable is the student's knowledge recall?",
      explanation: "Measures recall consistency. Compares first vs. last answer quality. Improving = retrieval practice is working. Declining = fatigue or weak memory consolidation.",
      valueMeanings: {
        "fluent": "Score 75%+. Strong, stable recall. The student can retrieve and apply knowledge consistently. Action: move to advanced topics.",
        "developing": "Score 50-74%. Recall is improving but not yet stable. The student needs more practice to consolidate. Action: spaced repetition, review sessions.",
        "fragmented": "Score below 50%. Recall is inconsistent — the student may know pieces but can't connect them. Action: go back to fundamentals, use analogies to build connections.",
        "improving": "Later answers scored higher than earlier ones. Retrieval practice is working — the student is warming up. Good sign.",
        "declining": "Later answers scored lower than earlier ones. May indicate fatigue, time pressure, or weak memory. Action: shorter sessions, check if the student is getting enough rest.",
      }
    },
  ];

  const tierColor = (tier: string) =>
    tier === "green" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : tier === "amber" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
    : tier === "red" ? "bg-red-500/10 text-red-600 border-red-500/30"
    : "bg-muted text-muted-foreground";

  // P1.1: Create a crisis flag for this student
  const createFlag = async () => {
    if (!portfolio?.student?.id) return;
    setFlagBusy(true);
    try {
      await api.post("/api/crisis-flags", {
        userId: portfolio.student.id,
        category: flagCategory,
        severity: flagSeverity,
      });
      const res = await api.get<{ flags: typeof crisisFlags }>(`/api/crisis-flags?userId=${portfolio.student.id}`);
      setCrisisFlags(res.flags || []);
      setShowFlagForm(false);
    } catch { /* non-blocking */ } finally { setFlagBusy(false); }
  };

  // P1.1: Resolve a crisis flag
  const resolveFlag = async (flagId: string) => {
    try {
      await api.patch("/api/crisis-flags", { flagId, status: "resolved" });
      const res = await api.get<{ flags: typeof crisisFlags }>(`/api/crisis-flags?userId=${portfolio.student.id}`);
      setCrisisFlags(res.flags || []);
    } catch { /* silent */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header — wellbeing tier + trajectory */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Psychological State
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            How {portfolio.student.name} thinks and feels — cognition, confidence, emotional state. Independent of grades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Wellbeing Tier</p>
              <Badge variant="outline" className={`mt-1 text-[10px] ${tierColor(wellbeingState?.tier || "green")}`}>
                {(wellbeingState?.tier || "green").toUpperCase()}
              </Badge>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Trajectory</p>
              <p className="text-sm font-bold text-foreground capitalize mt-1">{portfolio.psychTrend.trajectory.replace("-", " ")}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Confidence (latest)</p>
              <p className="text-sm font-bold text-foreground capitalize mt-1">{portfolio.psychTrend.latest?.confidence || "—"}</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Cognitive Load</p>
              <p className="text-sm font-bold text-foreground capitalize mt-1">{portfolio.psychTrend.latest?.cognitiveLoad || "—"}</p>
            </div>
          </div>

          {wellbeingState?.reasonsJson && (() => {
            try {
              const reasons = JSON.parse(wellbeingState.reasonsJson) as string[];
              if (!Array.isArray(reasons) || reasons.length === 0) return null;
              return (
                <div className="mt-3 rounded-md bg-amber-500/5 border border-amber-500/30 p-3">
                  <p className="text-xs font-medium text-amber-600 mb-1">Detection signals:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {reasons.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              );
            } catch { return null; }
          })()}
        </CardContent>
      </Card>

      {/* CrisisFlag — visually separate from the dimension list, per spec.
          P1.1: Always shown so the "Flag this student" button is always accessible. */}
      <Card className="border-red-500/40 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Crisis Flags
                {crisisFlags.filter(f => f.status === "open").length > 0 && (
                  <Badge variant="outline" className="text-[9px] bg-red-500/20 text-red-600 border-red-500/40">
                    {crisisFlags.filter(f => f.status === "open").length} open
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Existence/state shown here. Human response is on the Mentorship tab.
              </CardDescription>
            </div>
            {/* P1.1: Flag this student button — always available */}
            {!showFlagForm && (
              <Button onClick={() => setShowFlagForm(true)} size="sm" variant="outline" className="border-red-500/40 text-red-600 hover:bg-red-500/10">
                <AlertCircle className="h-3 w-3" /> Flag this student
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* P1.1: Flag creation form */}
          {showFlagForm && (
            <div className="rounded-md bg-background border border-red-500/30 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Create a crisis flag</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Category</Label>
                  <Select value={flagCategory} onValueChange={setFlagCategory}>
                    <SelectTrigger className="bg-muted border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="behavioral_concern">Behavioral Concern</SelectItem>
                      <SelectItem value="academic_crisis">Academic Crisis</SelectItem>
                      <SelectItem value="severe_distress">Severe Distress</SelectItem>
                      <SelectItem value="disclosure">Disclosure</SelectItem>
                      <SelectItem value="self_harm_risk">Self-Harm Risk</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Severity</Label>
                  <Select value={flagSeverity} onValueChange={(v) => setFlagSeverity(v as "amber" | "red")}>
                    <SelectTrigger className="bg-muted border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amber">Amber — needs follow-up</SelectItem>
                      <SelectItem value="red">Red — urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={createFlag} disabled={flagBusy} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  {flagBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
                  Create flag
                </Button>
                <Button onClick={() => setShowFlagForm(false)} size="sm" variant="outline" className="border-border">Cancel</Button>
              </div>
            </div>
          )}

          {/* Existing flags */}
          {crisisFlags.length === 0 && !showFlagForm ? (
            <p className="text-xs text-muted-foreground text-center py-2">No crisis flags. Click "Flag this student" if you have a concern.</p>
          ) : (
            crisisFlags.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-md bg-red-500/10 p-2">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{f.category.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Flagged {new Date(f.createdAt).toLocaleDateString()}
                    {f.resolvedAt && ` · resolved ${new Date(f.resolvedAt).toLocaleDateString()}`}
                    {" · "}<span className={`font-medium ${f.severity === "red" ? "text-red-600" : "text-amber-600"}`}>{f.severity}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[9px] ${
                    f.status === "open" ? "bg-red-500/10 text-red-600 border-red-500/30"
                    : f.status === "acknowledged" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  }`}>{f.status}</Badge>
                  {f.status === "open" && (
                    <Button onClick={() => resolveFlag(f.id)} size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" title="Resolve">
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 7 dimensions — expandable */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Seven Dimensions</CardTitle>
          <CardDescription className="text-muted-foreground">
            Each dimension shows a trajectory badge + one-line strength/gap, then expands to evidence with source links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DIMENSIONS.map(dim => {
            const dimEvidence = evidenceByDimension[dim.key] || [];
            const isOpen = expandedDim === dim.key;
            const latest = dimEvidence[0];
            return (
              <div key={dim.key} className="rounded-md border border-border">
                <button
                  onClick={() => setExpandedDim(isOpen ? null : dim.key)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{dim.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{dim.hint}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {latest ? (
                      <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground capitalize">{latest.value}</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">no data</span>
                    )}
                    <Badge variant="outline" className="text-[9px]">{dimEvidence.length}</Badge>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border p-3 space-y-2 bg-muted/20">
                    {/* Explanation of what this dimension measures */}
                    <div className="rounded-md bg-background/70 border border-border p-2 mb-2">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">What this measures: </span>
                        {(dim as any).explanation || dim.hint}
                      </p>
                    </div>
                    {/* What the current value means + teacher action */}
                    {latest && (dim as any).valueMeanings?.[latest.value] && (
                      <div className="rounded-md bg-primary/5 border border-primary/20 p-2 mb-2">
                        <p className="text-[10px] text-foreground leading-relaxed">
                          <span className="font-semibold text-primary">What "{latest.value}" means: </span>
                          {(dim as any).valueMeanings[latest.value]}
                        </p>
                      </div>
                    )}
                    {dimEvidence.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No evidence collected for this dimension yet. Take a test to generate evidence.</p>
                    ) : (
                      dimEvidence.map(ev => (
                        <div key={ev.id} className="text-xs">
                          <p className="text-foreground">{ev.evidenceText}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Source: {ev.sourceType}{ev.sourceId ? ` · ${ev.sourceId.slice(0, 8)}…` : ""}
                            {ev.week !== null && ` · Week ${ev.week}`}
                            {" · "}{new Date(ev.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Confidence ratings — calibration SCATTER CHART (Phase Three-Tab Redesign) */}
      {confidenceRatings.length > 0 && (
        <CalibrationScatterCard confidenceRatings={confidenceRatings} chartColors={c} />
      )}

      {/* Existing psychObs (legacy — kept for continuity) */}
      {portfolio.psychObs.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Historical Observations</CardTitle>
            <CardDescription className="text-muted-foreground">From weekly test analyses (legacy data)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[40vh] overflow-y-auto">
            {portfolio.psychObs.map(obs => (
              <div key={obs.id} className="rounded-md bg-muted p-2 text-xs">
                <p className="font-medium text-foreground">Week {obs.week} · {new Date(obs.date).toLocaleDateString()}</p>
                <p className="text-muted-foreground mt-1">{obs.remarks}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
