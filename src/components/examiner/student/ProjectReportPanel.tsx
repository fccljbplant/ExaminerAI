"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";

export function ProjectReportPanel() {
  const [reports, setReports] = useState<{
    id: string; week: number; reportType: string; reportText: string;
    aiAnalysis: {
      score: number; projectUnderstanding: number; technicalDepth: number;
      progress: number; clarity: number;
      strengths: string[]; weaknesses: string[]; feedback: string;
    } | null;
    submittedAt: string; analyzedAt: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [reportWeek, setReportWeek] = useState("1");
  const [reportType, setReportType] = useState<"weekly" | "final">("weekly");
  const [reportText, setReportText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ reports: typeof reports }>(
        "/api/project/reports",
        undefined,
        AI_TIMEOUT_MS
      );
      setReports(res.reports || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim() || reportText.trim().length < 20) {
      setMsgType("error");
      setMsg("Report must be at least 20 characters");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const res = await api.post<{ report: typeof reports[0]; warning?: string }>(
        "/api/project/reports",
        { week: Number(reportWeek), reportType, reportText: reportText.trim() },
        AI_TIMEOUT_MS
      );
      setMsgType("success");
      setMsg(res.report.aiAnalysis
        ? `Report submitted + AI analyzed! Score: ${res.report.aiAnalysis.score}%`
        : "Report submitted. AI analysis failed — you can retry later."
      );
      setReportText(""); setShowForm(false);
      await load();
    } catch (e) {
      setMsgType("error");
      setMsg(e instanceof Error ? e.message : "Failed to submit report");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Project Reports
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Submit weekly or final project reports. The AI analyzes each report like a practice question.
            </CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> Submit Report
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {msg && <p className={`text-xs ${msgType === "error" ? "text-destructive" : "text-primary"}`}>{msg}</p>}

        {showForm && (
          <form onSubmit={submit} className="rounded-md border border-border bg-background p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Report Type</Label>
                <Select value={reportType} onValueChange={(v) => {
                  setReportType(v as "weekly" | "final");
                  if (v === "final") setReportWeek("0");
                  else if (reportWeek === "0") setReportWeek("1");
                }}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly Report</SelectItem>
                    <SelectItem value="final">Final Capstone Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Week</Label>
                <Select value={reportWeek} onValueChange={setReportWeek} disabled={reportType === "final"}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {reportType === "final"
                      ? <SelectItem value="0">Final Report</SelectItem>
                      : Array.from({ length: 20 }, (_, i) => i + 1).map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">
                {reportType === "final" ? "Final project report — describe what you built, challenges, learnings, and outcomes" : "What did you work on this week? Describe your progress, challenges, and learnings"}
              </Label>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder={reportType === "final"
                  ? "e.g. For my final project, I built a restaurant website with online reservations. The biggest challenge was..."
                  : "e.g. This week I built the homepage, connected the database, and struggled with..."}
                className="bg-background border-border min-h-32 text-xs"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {busy ? "Submitting + Analyzing..." : "Submit & Analyze with AI"}
              </Button>
              <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => { setShowForm(false); setReportText(""); setMsg(""); }}>Cancel</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              💡 The AI will analyze your report for project understanding, technical depth, progress, and clarity — just like it evaluates your practice answers.
            </p>
          </form>
        )}

        {/* Existing reports */}
        {reports.length === 0 && !showForm ? (
          <div className="text-center py-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No project reports yet.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Submit a weekly report to get AI feedback on your project progress.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="rounded-md border border-border bg-background/70 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] text-primary border-primary/30">
                      {r.reportType === "final" ? "Final Report" : `Week ${r.week}`}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</span>
                  </div>
                  {r.aiAnalysis && (
                    <Badge variant="outline" className={`text-[10px] ${r.aiAnalysis.score >= 70 ? "text-emerald-600 border-emerald-500/30" : r.aiAnalysis.score >= 50 ? "text-amber-600 border-amber-500/30" : "text-destructive border-destructive/30"}`}>
                      Score: {r.aiAnalysis.score}%
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground/80 leading-snug whitespace-pre-wrap">{r.reportText}</p>
                {r.aiAnalysis ? (
                  <div className="space-y-1.5 pt-1.5 border-t border-border">
                    {/* Score breakdown */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Understanding", val: r.aiAnalysis.projectUnderstanding },
                        { label: "Technical", val: r.aiAnalysis.technicalDepth },
                        { label: "Progress", val: r.aiAnalysis.progress },
                        { label: "Clarity", val: r.aiAnalysis.clarity },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-[8px] text-muted-foreground uppercase">{s.label}</p>
                          <p className={`text-xs font-bold ${s.val >= 70 ? "text-emerald-600" : s.val >= 50 ? "text-amber-600" : "text-destructive"}`}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                    {r.aiAnalysis.strengths.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-emerald-600 mb-0.5">✓ Strengths</p>
                        <ul className="text-[11px] text-foreground/70 space-y-0.5 ml-3">
                          {r.aiAnalysis.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {r.aiAnalysis.weaknesses.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-amber-600 mb-0.5">⚠ Areas to Improve</p>
                        <ul className="text-[11px] text-foreground/70 space-y-0.5 ml-3">
                          {r.aiAnalysis.weaknesses.map((s, i) => <li key={i}>• {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {r.aiAnalysis.feedback && (
                      <div className="rounded-md bg-primary/5 p-2">
                        <p className="text-[10px] font-medium text-primary mb-0.5">💡 AI Feedback</p>
                        <p className="text-[11px] text-foreground/80 leading-snug">{r.aiAnalysis.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">AI analysis pending — submit again to retry.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
