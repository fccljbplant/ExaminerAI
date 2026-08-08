"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scoreToGrade, gradeColor, PILLARS } from "@/lib/constants";
import { showError, showSuccess } from "@/lib/toast-helpers";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/components/examiner/student/types";
import { StatSquareCard, GanttChartIcon, GithubIcon, safeParse } from "@/components/examiner/student/shared";
import { FinalResultPanel } from "@/components/examiner/student/FinalResultPanel";
import { ProjectReportPanel } from "@/components/examiner/student/ProjectReportPanel";
import { GrowthReportPanel } from "@/components/examiner/student/GrowthReportPanel";

// Certificate generation card — student REQUESTS, instructor APPROVES
function CertificateCard() {
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<{
    id: string; courseName: string; studentName: string; grade: string;
    score: number; issuedAt: string; signedBy: string; verifyToken: string;
  } | null>(null);
  const [requested, setRequested] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ certificate?: any; requested?: boolean; message?: string; alreadyExisted?: boolean }>(`/api/certificates/generate`);
      if (res.certificate) {
        setCertificate(res.certificate);
        showSuccess("Certificate approved and generated!");
      } else if (res.requested) {
        setRequested(true);
        setRequestMessage(res.message || "Request submitted. Waiting for instructor approval.");
        showSuccess("Certificate request submitted! Your instructor will review it.");
      } else if (res.alreadyExisted && res.certificate) {
        setCertificate(res.certificate);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Not eligible yet — complete all weekly tests first.");
    } finally { setLoading(false); }
  };

  const load = async () => {
    try {
      const res = await api.get<{ certificate: any }>(`/api/certificates/user`);
      if (res.certificate) {
        if (res.certificate.grade === "PENDING") {
          setRequested(true);
          setRequestMessage("Certificate request submitted. Waiting for instructor approval.");
        } else {
          setCertificate(res.certificate);
        }
      }
    } catch { /* no certificate yet */ }
  };

  // Load existing certificate on mount
  useState(() => { load(); });

  if (certificate) {
    return (
      <Card className="border-growth-amber bg-growth-amber-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-growth-amber" /> Certificate of Completion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-foreground">{certificate.studentName}</p>
              <p className="text-xs text-muted-foreground">{certificate.courseName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-2xl font-bold p-2">
                <span className={gradeColor(certificate.grade)}>{certificate.grade}</span>
              </Badge>
              <Badge variant="outline" className="text-sm">{certificate.score}%</Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Issued {new Date(certificate.issuedAt).toLocaleDateString()} · Signed by {certificate.signedBy}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/verify/${certificate.verifyToken}`, "_blank")}
          >
            <ExternalLink className="h-3 w-3" /> View / Share Certificate
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (requested) {
    return (
      <Card className="border-growth-amber bg-growth-amber-soft">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 text-growth-amber mx-auto mb-2 animate-spin" style={{ animationDuration: "3s" }} />
          <h3 className="text-sm font-semibold text-foreground mb-1">Certificate Requested</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">{requestMessage}</p>
          <p className="text-xs text-muted-foreground/70 mt-2">Your instructor will review your completion and approve it.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6 text-center">
        <Award className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-foreground mb-1">Certificate of Completion</h3>
        <p className="text-xs text-muted-foreground mb-3 max-w-xs mx-auto">
          Complete all weekly tests to request your certificate. Your instructor will review and approve it. It's publicly verifiable via a shareable URL.
        </p>
        <Button onClick={generate} disabled={loading} size="sm" className="bg-growth-amber hover:bg-amber-600 text-white">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />}
          Request Certificate
        </Button>
      </CardContent>
    </Card>
  );
}

export function ReportCardPanel({ reportCards, comments, studentId, courseId }: { reportCards: ReportCardRow[]; comments: CommentRow[]; studentId?: string; courseId?: string }) {
  return (
    <div className="space-y-4">
      {/* Certificate — students can generate when they complete the course */}
      <CertificateCard />

      {/* H11 fix: Private Growth Report — was generated but never shown to anyone.
          Now surfaced here so students can see their honest strengths + shortcomings. */}
      {studentId && <GrowthReportPanel studentId={studentId} />}

      {/* SDT rebalance: Final Result only shown when the student has completed at least
          1 weekly test. Showing "Career Readiness: Not Ready" + "0/6 tests" to a Week-1
          student is demoralizing. Replace with an encouraging empty state. */}
      <FinalResultPanel />

      {/* Project Reports — student submits weekly/final project reports + AI analyzes them */}
      <ProjectReportPanel />

      {reportCards.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No weekly report cards yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Report cards are generated by your instructor after each weekly test. Complete your weekly test to unlock your first report card.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        reportCards.map((rc) => (
          <Card key={rc.week} className="border-border bg-card">
            <CardHeader>
              {/* Phase 6.2: flex-wrap so the grade + score wrap below the title on small screens */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-foreground">Week {rc.week} Report Card</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xl sm:text-2xl font-bold p-2 border-border">
                    <span className={gradeColor(rc.grade)}>{rc.grade}</span>
                  </Badge>
                  <span className="text-base sm:text-lg font-semibold text-foreground/80">{rc.score}%</span>
                </div>
              </div>
            </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-primary mb-1">Strengths</p>
                <ul className="text-foreground/80 list-disc list-inside">
                  {safeParse(rc.strengths).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs text-destructive mb-1">Weaknesses</p>
                <ul className="text-foreground/80 list-disc list-inside">
                  {safeParse(rc.weaknesses).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
            <div><p className="text-xs text-muted-foreground">Progress</p><p className="text-foreground">{rc.progress}</p></div>
            <div>
              <p className="text-xs text-secondary-foreground mb-1">Next Steps</p>
              <ul className="text-foreground/80 list-disc list-inside">
                {safeParse(rc.nextSteps).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            {/* Teacher comments on this report card */}
            {comments.filter(c => c.body?.includes(`[Week ${rc.week} Report Card]`)).map(c => (
              <div key={c.id} className="rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-primary flex items-center gap-1">
                    <MessageSquare className="h-2.5 w-2.5" /> {c.instructor.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-foreground/80 break-words">{c.body?.replace(`[Week ${rc.week} Report Card] `, "")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))
      )}
    </div>
  );
}
