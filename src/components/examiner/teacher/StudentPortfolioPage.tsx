"use client";

import { showError } from "@/lib/toast-helpers";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { canSeeAuditTab } from "@/lib/client-rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scoreToGrade, gradeColor } from "@/lib/constants";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { StudentRow, PortfolioData } from "@/components/examiner/teacher/types";
import { TeacherCourseProgressView } from "@/components/examiner/teacher/TeacherCourseProgressView";
import { PsychologicalTab } from "@/components/examiner/teacher/PsychologicalTab";
import { EducationalTab } from "@/components/examiner/teacher/EducationalTab";
import { MentorshipTabV2 } from "@/components/examiner/teacher/MentorshipTabV2";
import { UserAuditTab } from "@/components/examiner/teacher/UserAuditTab";
import { StudentAITools } from "@/components/examiner/teacher/ai/StudentAITools";
import { GuardianCreationPanel } from "@/components/examiner/teacher/GuardianCreationPanel";
import { ProminentTabs } from "@/components/shared/prominent-tabs";

export function StudentPortfolioPage({
  student,
  onBack,
  onMessage,
  onNext,
  onPrev,
  studentPosition,
}: {
  student: StudentRow;
  onBack: () => void;
  onMessage: (studentId: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
  studentPosition?: string;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"project" | "wizard" | "logs" | "assessments" | "report-cards" | "comments" | "psychological" | "educational" | "mentorship" | "audit">("project");
  const [commentBody, setCommentBody] = useState("");
  const [commentTarget, setCommentTarget] = useState<string>("general");
  const [posting, setPosting] = useState(false);
  // Fetch current user's role for audit-tab visibility
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const isPrivilegedRole = canSeeAuditTab(currentUserRole);

  // --- Weekly Test Comment Dialog state ---
  const [wtCommentFor, setWtCommentFor] = useState<{ testId: string; week: number } | null>(null);
  const [wtCommentBody, setWtCommentBody] = useState("");
  const [wtCommentGrade, setWtCommentGrade] = useState<string>("");
  const [wtPosting, setWtPosting] = useState(false);

  // --- Generic Entity Comment Dialog state (for check-ins, practice, tasks) ---
  // Works on ANY entity: dailyLog, interaction, or task.
  const [entityCommentFor, setEntityCommentFor] = useState<{ type: "dailyLog" | "interaction" | "task"; id: string; label: string } | null>(null);
  const [entityCommentBody, setEntityCommentBody] = useState("");
  const [entityCommentGrade, setEntityCommentGrade] = useState<string>("");
  const [entityPosting, setEntityPosting] = useState(false);

  // --- Report Card Dialog state ---
  // When rcDialogOpen is true, the report card generation dialog is open.
  // Teacher picks a week (1-6) and clicks Generate.
  const [rcDialogOpen, setRcDialogOpen] = useState(false);
  const [rcSelectedWeek, setRcSelectedWeek] = useState<string>("");
  const [rcGenerating, setRcGenerating] = useState(false);
  // Edit state for existing report cards
  const [rcEditFor, setRcEditFor] = useState<number | null>(null);
  const [rcEditGrade, setRcEditGrade] = useState("");
  const [rcEditScore, setRcEditScore] = useState("");
  const [rcEditExaminerObs, setRcEditExaminerObs] = useState("");
  const [rcEditSaving, setRcEditSaving] = useState(false);
  // Comment state for report cards
  const [rcCommentFor, setRcCommentFor] = useState<number | null>(null);
  const [rcCommentBody, setRcCommentBody] = useState("");

  // --- Weekly Test Edit AI Results Dialog state ---
  const [wtEditFor, setWtEditFor] = useState<{ testId: string; week: number } | null>(null);
  const [wtEditScore, setWtEditScore] = useState("");
  const [wtEditPsych, setWtEditPsych] = useState("");
  const [wtEditComment, setWtEditComment] = useState("");
  const [wtEditSaving, setWtEditSaving] = useState(false);

  const loadPortfolio = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await api.get<PortfolioData>(`/api/students/${studentId}/portfolio`);
      setPortfolio(res);
    } catch {
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio(student.id);
    setTab("project");
    setCommentBody("");
    setCommentTarget("general");
  }, [student.id, loadPortfolio]);

  // Fetch current user's role (for audit-tab visibility)
  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.role) setCurrentUserRole(res.user.role);
    }).catch(() => {/* silent */});
  }, []);

  const submitComment = async () => {
    if (!student || !commentBody.trim()) return;
    setPosting(true);
    try {
      const payload: Record<string, unknown> = {
        studentId: student.id,
        body: commentBody.trim(),
      };
      if (commentTarget !== "general") {
        if (commentTarget.startsWith("task-")) {
          payload.taskId = commentTarget.replace("task-", "");
        } else {
          payload.interactionId = commentTarget;
        }
      }
      await api.post("/api/comments", payload);
      setCommentBody("");
      setCommentTarget("general");
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  // --- Weekly Test Comment handlers ---
  const openWtComment = (testId: string, week: number, currentScore: number | null) => {
    setWtCommentFor({ testId, week });
    setWtCommentBody("");
    setWtCommentGrade(currentScore !== null ? String(currentScore) : "");
  };

  const submitWtComment = async () => {
    if (!student || !wtCommentFor) return;
    if (!wtCommentBody.trim()) {
      showError("Please write a comment first.");
      return;
    }
    setWtPosting(true);
    try {
      const payload: Record<string, unknown> = {
        studentId: student.id,
        body: wtCommentBody.trim(),
        weeklyTestId: wtCommentFor.testId,
      };
      // If a grade is provided, also override the weekly test score
      const gradeNum = wtCommentGrade.trim() === "" ? null : Number(wtCommentGrade);
      if (gradeNum !== null && !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 100) {
        payload.marksOverride = gradeNum;
        // Also update the actual weekly test score via the override endpoint
        await api.post("/api/grades/override", {
          type: "weeklyTest",
          id: wtCommentFor.testId,
          score: gradeNum,
        }).catch(() => {}); // non-blocking — comment is the primary action
      }
      await api.post("/api/comments", payload);
      setWtCommentBody("");
      setWtCommentGrade("");
      setWtCommentFor(null);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setWtPosting(false);
    }
  };

  const deleteWtComment = async (commentId: string) => {
    if (!student) return;
    if (!confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await api.del(`/api/comments?id=${commentId}`);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to delete comment");
    }
  };

  // --- Generic Entity Comment handlers (work on ANY entity type) ---
  /** Opens the comment dialog for any entity (dailyLog, interaction, task). */
  const openEntityComment = (type: "dailyLog" | "interaction" | "task", id: string, label?: string) => {
    setEntityCommentFor({ type, id, label: label || type });
    setEntityCommentBody("");
    setEntityCommentGrade("");
  };

  /** Submits a comment on the currently-open entity. */
  const submitEntityComment = async () => {
    if (!student || !entityCommentFor) return;
    if (!entityCommentBody.trim()) { showError("Please write a comment first."); return; }
    setEntityPosting(true);
    try {
      const payload: Record<string, unknown> = {
        studentId: student.id,
        body: entityCommentBody.trim(),
      };
      // Set the right field based on entity type
      if (entityCommentFor.type === "dailyLog") payload.dailyLogId = entityCommentFor.id;
      else if (entityCommentFor.type === "interaction") payload.interactionId = entityCommentFor.id;
      else if (entityCommentFor.type === "task") payload.taskId = entityCommentFor.id;
      // Optional grade override
      const gradeNum = entityCommentGrade.trim() === "" ? null : Number(entityCommentGrade);
      if (gradeNum !== null && !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 100) {
        payload.marksOverride = gradeNum;
      }
      await api.post("/api/comments", payload);
      setEntityCommentBody("");
      setEntityCommentGrade("");
      setEntityCommentFor(null);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setEntityPosting(false);
    }
  };

  /** Deletes ANY comment (used by all entity comment sections). */
  const deleteComment = async (commentId: string) => {
    if (!student) return;
    if (!confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await api.del(`/api/comments?id=${commentId}`);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to delete comment");
    }
  };

  /** Opens the report card generation dialog, pre-selecting the student's current week. */
  const openReportCardDialog = (currentWeek: number) => {
    setRcSelectedWeek(String(currentWeek));
    setRcDialogOpen(true);
  };

  /** Generates a report card for the selected week. */
  const generateReportCard = async (studentId: string, week: number) => {
    setRcGenerating(true);
    try {
      const data = await api.post<{ reportCard?: any; error?: string }>(`/api/students/${studentId}/generate-report-card`, { week });
      if (data.error) throw new Error(data.error);
      setRcDialogOpen(false);
      await loadPortfolio(studentId);
      // Switch to report cards tab so teacher sees the result
      setTab("report-cards");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to generate report card");
    } finally {
      setRcGenerating(false);
    }
  };

  /** Opens the report card edit dialog for a specific week. */
  const openRcEdit = (week: number, grade: string, score: number, examinerObs: string) => {
    setRcEditFor(week);
    setRcEditGrade(grade);
    setRcEditScore(String(score));
    setRcEditExaminerObs(examinerObs);
  };

  /** Saves report card edits. */
  const saveRcEdit = async () => {
    if (!student || rcEditFor === null) return;
    setRcEditSaving(true);
    try {
      await api.post("/api/report-cards", {
        userId: student.id,
        week: rcEditFor,
        grade: rcEditGrade,
        score: Number(rcEditScore) || 0,
        examinerObservations: rcEditExaminerObs,
      });
      setRcEditFor(null);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setRcEditSaving(false);
    }
  };

  /** Submits a comment on a report card (stored as a general comment with the week in the body). */
  const submitRcComment = async () => {
    if (!student || rcCommentFor === null || !rcCommentBody.trim()) return;
    try {
      await api.post("/api/comments", {
        studentId: student.id,
        body: `[Week ${rcCommentFor} Report Card] ${rcCommentBody.trim()}`,
      });
      setRcCommentBody("");
      setRcCommentFor(null);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to post comment");
    }
  };

  // --- Weekly Test Edit AI Results handlers ---
  const openWtEdit = (testId: string, week: number, score: number | null, psych: string | null, comment: string | null) => {
    setWtEditFor({ testId, week });
    setWtEditScore(score !== null ? String(score) : "");
    setWtEditPsych(psych ?? "");
    setWtEditComment(comment ?? "");
  };

  const saveWtEdit = async () => {
    if (!student || !wtEditFor) return;
    setWtEditSaving(true);
    try {
      const payload: Record<string, unknown> = { week: wtEditFor.week };
      const scoreNum = wtEditScore.trim() === "" ? null : Number(wtEditScore);
      if (scoreNum !== null && !Number.isNaN(scoreNum)) {
        if (scoreNum < 0 || scoreNum > 100) {
          showError("Score must be 0-100.");
          setWtEditSaving(false);
          return;
        }
        payload.score = scoreNum;
      }
      payload.psychAnalysis = wtEditPsych;
      payload.examinerComment = wtEditComment;

      await api.patch(`/api/students/${student.id}/edit-weekly-test`, payload);
      setWtEditFor(null);
      await loadPortfolio(student.id);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to save edits");
    } finally {
      setWtEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="space-y-4">
        <Button onClick={onBack} variant="outline" size="sm" className="border-border">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">Failed to load portfolio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Back button + student header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={onBack} variant="outline" size="sm" className="border-border flex-shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onPrev && (
            <Button onClick={onPrev} variant="outline" size="sm" className="border-border px-2" title="Previous student" aria-label="Previous student">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {studentPosition && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{studentPosition}</span>
          )}
          {onNext && (
            <Button onClick={onNext} variant="outline" size="sm" className="border-border px-2" title="Next student" aria-label="Next student">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => openReportCardDialog(student.currentWeek)} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
            <FileText className="h-3 w-3" /> Report Card
          </Button>
          <Button onClick={() => onMessage(student.id)} variant="outline" size="sm" className="border-border">
            <Mail className="h-3 w-3" /> Message
          </Button>
        </div>
      </div>

      {/* AI Tools — explain, narrative, draft check-in, rehearse */}
      <StudentAITools studentId={student.id} studentName={student.name} onDraftCheckin={(draft) => {
        // Could wire to compose dialog — for now, copy to clipboard
        navigator.clipboard?.writeText(draft);
      }} />

      {/* H6 fix: Guardian creation/management — staff can create a parent
          account linked to this student, or remove an existing one. */}
      <GuardianCreationPanel studentId={student.id} studentName={student.name} />

      {/* Summary stats — responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-md bg-muted p-2">
          <p className="text-[10px] text-muted-foreground">Week</p>
          <p className="text-sm font-bold text-foreground">{portfolio.student.currentWeek} / 6</p>
        </div>
        <div className="rounded-md bg-muted p-2">
          <p className="text-[10px] text-muted-foreground">Progress</p>
          <p className="text-sm font-bold text-primary">{portfolio.hasProject ? `${portfolio.progress}%` : "—"}</p>
        </div>
        <div className="rounded-md bg-muted p-2">
          <p className="text-[10px] text-muted-foreground">Tasks</p>
          <p className="text-sm font-bold text-foreground">{portfolio.taskSummary.completed}/{portfolio.taskSummary.total}</p>
        </div>
        <div className="rounded-md bg-muted p-2">
          <p className="text-[10px] text-muted-foreground">Assessments</p>
          <p className="text-sm font-bold text-foreground">{portfolio.interactions.length}</p>
        </div>
      </div>

      {/* Tabs — prominent, theme-synced, horizontally scrollable on mobile.
          Phase Three-Tab Redesign: 'trends' replaced with 'psychological' | 'educational' | 'mentorship'. */}
      <ProminentTabs
        tabs={[
          { key: "project", label: "Project", icon: FolderOpen },
          { key: "wizard", label: "Progress", icon: TrendingUp },
          { key: "logs", label: "Check-Ins", icon: CalendarCheck },
          { key: "assessments", label: "Assessments", icon: ClipboardList },
          { key: "report-cards", label: "Report Cards", icon: FileText },
          { key: "psychological", label: "Psychological", icon: Brain },
          { key: "educational", label: "Educational", icon: GraduationCap },
          { key: "mentorship", label: "Mentorship", icon: HeartHandshake },
          { key: "comments", label: `Comments (${portfolio.comments.length})`, icon: MessageSquare },
          // Audit tab — visible to principal + administrator (full oversight).
          // Also visible to the user themselves + teachers (limited to their batch).
          ...(isPrivilegedRole ? [{ key: "audit" as const, label: "Audit", icon: ShieldCheck }] : []),
        ]}
        active={tab}
        onChange={(key) => setTab(key as typeof tab)}
        variant="underline"
        size="md"
      />

      {/* Tab content — full width, properly scrollable */}
      <div className="min-h-[300px]">
        {tab === "project" && (
          <div className="space-y-2">
            {!portfolio.hasProject ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No project started yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  This student hasn't added any tasks to their project plan.
                </p>
              </div>
            ) : (
              <>
                {portfolio.taskSummary.blocked > 0 && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 mb-2">
                    <strong>{portfolio.taskSummary.blocked} blocked task{portfolio.taskSummary.blocked > 1 ? "s" : ""}</strong> — consider reviewing these with the student.
                  </div>
                )}
                {portfolio.tasks.filter(t => t.id).map((t) => (
                  <div key={t.id} className="rounded-md bg-muted p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">Week {t.week}</Badge>
                          <Badge variant="outline" className={`text-[10px] capitalize ${
                            t.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                            t.status === "in-progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                            t.status === "blocked" ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                            "bg-muted text-muted-foreground"
                          }`}>{t.status}</Badge>
                        </div>
                        <p className="text-foreground break-words">{t.description}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEntityComment("task", t.id, `Task: ${t.description.slice(0, 30)}`)}
                          className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Comment on this task" aria-label="Comment on this task"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this task?")) { api.del(`/api/tasks?id=${t.id}`).then(() => loadPortfolio(student.id)); } }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete this task" aria-label="Delete this task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {/* Show teacher comments for this task */}
                    {portfolio.comments.filter(c => c.taskId === t.id).map(c => (
                      <div key={c.id} className="mt-1.5 rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-primary">{c.teacher.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                            <button onClick={() => deleteComment(c.id)} className="text-destructive hover:underline"><Trash2 className="h-2.5 w-2.5" /></button>
                          </div>
                        </div>
                        {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "wizard" && (
          <TeacherCourseProgressView portfolio={portfolio} student={student} />
        )}

        {tab === "logs" && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {portfolio.dailyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No daily check-ins yet.</p>
            ) : (
              portfolio.dailyLogs.map((log) => (
                <div key={log.id} className="rounded-md bg-muted p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Week {log.week} · {new Date(log.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">Confidence {log.confidence}/5</Badge>
                      <button
                        onClick={() => openEntityComment("dailyLog", log.id)}
                        className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Comment on this check-in" aria-label="Comment on this check-in"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this check-in?")) { api.del(`/api/daily-logs/${log.id}`).then(() => loadPortfolio(student.id)); } }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete this check-in" aria-label="Delete this check-in"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-foreground break-words">{log.whatDidYouDo}</p>
                  {log.anyErrors && <p className="text-xs text-destructive mt-1 break-words">{log.anyErrors}</p>}
                  {/* Show teacher comments for this check-in */}
                  {portfolio.comments.filter(c => c.dailyLogId === log.id).map(c => (
                    <div key={c.id} className="mt-1.5 rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-primary">{c.teacher.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => deleteComment(c.id)} className="text-[10px] text-destructive hover:underline"><Trash2 className="h-2.5 w-2.5" /></button>
                        </div>
                      </div>
                      {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "assessments" && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Weekly Tests — TOP, 50% weight */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" /> Weekly Tests
                </p>
                <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary font-semibold">50% weight</Badge>
              </div>
              {portfolio.weeklyTests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No weekly tests yet.</p>
              ) : (
                portfolio.weeklyTests.map((wt) => (
                  <div key={wt.week} className={`rounded-md p-3 text-sm mb-2 ${wt.status === "completed" ? "bg-primary/5 border border-primary/20" : "bg-muted border border-border"}`}>
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">Week {wt.week}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{wt.status}</Badge>
                        {wt.retakeAllowed && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10">Retake allowed</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {wt.status === "completed" && (
                          <span className={`font-bold text-base ${gradeColor(scoreToGrade(wt.score ?? 0))}`}>{wt.score ?? "—"}%</span>
                        )}
                        {wt.status === "completed" && (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={wt.score ?? ""}
                            className="w-16 h-7 text-xs bg-background border-border"
                            placeholder="Override"
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val <= 100 && val !== wt.score) {
                                // FIX: use wt.id (the real cuid), not "week-N"
                                api.post("/api/grades/override", { type: "weeklyTest", id: wt.id, score: val })
                                  .then(() => loadPortfolio(student.id))
                                  .catch((err) => showError(err?.message || "Failed to override score"));
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                    {wt.examinerComment && <p className="text-xs text-foreground/80 mt-1 break-words">{wt.examinerComment}</p>}
                    {wt.psychAnalysis && <p className="text-xs text-violet-600 mt-1 italic break-words">Psych: {wt.psychAnalysis}</p>}
                    {wt.completedAt && <p className="text-[10px] text-muted-foreground mt-1">Completed {new Date(wt.completedAt).toLocaleDateString()}</p>}
                    {/* Plagiarism score for weekly test */}
                    {(wt as { plagiarismScore?: number | null }).plagiarismScore != null && (wt as { plagiarismScore?: number | null }).plagiarismScore! > 0 && (
                      <div className={"rounded-md p-1.5 mt-1 " + ((wt as { plagiarismScore?: number | null }).plagiarismScore! > 40 ? "bg-red-500/10 border border-red-500/30" : "bg-amber-500/10 border border-amber-500/30")}>
                        <p className={"text-[10px] font-bold " + ((wt as { plagiarismScore?: number | null }).plagiarismScore! > 40 ? "text-red-600" : "text-amber-600")}>
                          Plagiarism Risk: {(wt as { plagiarismScore?: number | null }).plagiarismScore}%
                        </p>
                      </div>
                    )}
                    {/* Teacher actions */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {wt.status === "completed" && (
                        <>
                          {/* Comment button — opens dialog with grade + previous comments */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => openWtComment(wt.id, wt.week, wt.score ?? null)}
                          >
                            <MessageSquare className="h-3 w-3" /> Comment
                          </Button>
                          {/* Edit AI Results button — opens dialog to edit psychAnalysis, examinerComment, score */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                            onClick={() => openWtEdit(wt.id, wt.week, wt.score ?? null, wt.psychAnalysis ?? null, wt.examinerComment ?? null)}
                          >
                            <Edit3 className="h-3 w-3" /> Edit AI Results
                          </Button>
                          {/* Retake controls — give OR revoke */}
                          {!wt.retakeAllowed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                              onClick={() => {
                                if (confirm(`Allow ${student.name} to retake Week ${wt.week} test? Their previous result will be replaced when they start the retake.`)) {
                                  api.post(`/api/students/${student.id}/allow-retake`, { week: wt.week })
                                    .then(() => loadPortfolio(student.id))
                                    .catch((e) => showError(e?.message || "Failed to allow retake"));
                                }
                              }}
                            >
                              <RefreshCw className="h-3 w-3" /> Allow Retake
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm(`Revoke retake access for Week ${wt.week} test? The student will no longer be able to retake it.`)) {
                                  api.del(`/api/students/${student.id}/allow-retake?week=${wt.week}`)
                                    .then(() => loadPortfolio(student.id))
                                    .catch((e: any) => showError(e?.message || "Failed to revoke retake"));
                                }
                              }}
                            >
                              <Lock className="h-3 w-3" /> Revoke Retake
                            </Button>
                          )}
                        </>
                      )}
                      {(wt.status === "locked" || wt.status === "available") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => {
                            if (confirm(`Unlock Week ${wt.week} test for ${student.name}? They can take it without completing tasks.`)) {
                              api.post(`/api/students/${student.id}/unlock-test`, { week: wt.week })
                                .then(() => loadPortfolio(student.id))
                                .catch((e) => showError(e?.message || "Failed to unlock test"));
                            }
                          }}
                        >
                          <Lock className="h-3 w-3" /> Unlock Test (bypass tasks)
                        </Button>
                      )}
                      {wt.status === "in-progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Reset Week ${wt.week} test for ${student.name}? Their in-progress conversation will be cleared.`)) {
                              api.post(`/api/students/${student.id}/unlock-test`, { week: wt.week, action: "reset" })
                                .then(() => loadPortfolio(student.id))
                                .catch((e) => showError(e?.message || "Failed to reset test"));
                            }
                          }}
                        >
                          <RefreshCw className="h-3 w-3" /> Reset In-Progress Test
                        </Button>
                      )}
                    </div>
                    {/* Inline teacher comments on this weekly test */}
                    {portfolio.comments.filter(c => c.weeklyTestId === wt.id).map(c => (
                      <div key={c.id} className="mt-1.5 rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-primary">{c.teacher.name}</span>
                          <div className="flex items-center gap-1">
                            {c.marksOverride !== null && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Score: {c.marksOverride}%</Badge>}
                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                            <button onClick={() => deleteComment(c.id)} className="text-destructive hover:text-destructive/80" title="Delete" aria-label="Delete comment"><Trash2 className="h-2.5 w-2.5" /></button>
                          </div>
                        </div>
                        {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                      </div>
                    ))}
                  </div>
                ))
              )}
              {/* Quick-unlock any week (even if no test exists yet) */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground self-center">Quick unlock:</span>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                  <Button
                    key={w}
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      if (!confirm(`Unlock Week ${w} test for this student?`)) return;
                      api.post(`/api/students/${student.id}/unlock-test`, { week: w })
                        .then(() => loadPortfolio(student.id))
                        .catch((e) => showError(e?.message || `Week ${w} test could not be unlocked (might already exist)`));
                    }}
                    title={`Unlock Week ${w} test`}
                  >
                    <KeyRound className="h-3 w-3" /> W{w}
                  </Button>
                ))}
              </div>
            </div>

            {/* Practice Questions — BELOW, 50% weight */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /> Practice Questions
                </p>
                <Badge variant="secondary" className="text-[10px] bg-secondary text-foreground/70 font-semibold">50% weight</Badge>
              </div>
              {portfolio.interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No practice questions yet.</p>
              ) : (
                portfolio.interactions.map((i) => (
                  <div key={i.id} className="rounded-md bg-muted p-3 text-sm mb-2">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{i.pillar}</Badge>
                        <Badge variant="outline" className="text-[10px]">{i.level}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${gradeColor(scoreToGrade(i.correctness))}`}>{i.correctness}%</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={i.correctness}
                          className="w-16 h-7 text-xs bg-background border-border"
                          placeholder="Override"
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val <= 100 && val !== i.correctness) {
                              api.post("/api/grades/override", { type: "interaction", id: i.id, score: val }).then(() => loadPortfolio(student.id));
                            }
                          }}
                        />
                        <button
                          onClick={() => openEntityComment("interaction", i.id, `Practice: ${i.topic.slice(0, 30)}`)}
                          className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Comment on this practice question" aria-label="Comment on this practice question"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this practice question?")) { api.del(`/api/interactions/${i.id}`).then(() => loadPortfolio(student.id)); } }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete this practice question" aria-label="Delete this practice question"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{i.topic}</p>
                    <p className="text-foreground text-xs break-words"><strong>Q:</strong> {i.question}</p>
                    {i.studentAnswer && <p className="text-foreground/70 text-xs mt-1 break-words"><strong>A:</strong> {i.studentAnswer.slice(0, 200)}{i.studentAnswer.length > 200 ? "…" : ""}</p>}
                    {i.feedback && <p className="text-xs text-primary mt-1 break-words">{i.feedback}</p>}
                    {/* Plagiarism score */}
                    {(i as { plagiarismScore?: number | null }).plagiarismScore != null && (i as { plagiarismScore?: number | null }).plagiarismScore! > 0 && (
                      <div className={"rounded-md p-1.5 mt-1 " + ((i as { plagiarismScore?: number | null }).plagiarismScore! > 40 ? "bg-red-500/10 border border-red-500/30" : "bg-amber-500/10 border border-amber-500/30")}>
                        <p className={"text-[10px] font-bold " + ((i as { plagiarismScore?: number | null }).plagiarismScore! > 40 ? "text-red-600" : "text-amber-600")}>
                          Plagiarism Risk: {(i as { plagiarismScore?: number | null }).plagiarismScore}%
                        </p>
                      </div>
                    )}
                    {/* Show teacher comments for this practice question */}
                    {portfolio.comments.filter(c => c.interactionId === i.id).map(c => (
                      <div key={c.id} className="mt-1.5 rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-primary">{c.teacher.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                            <button onClick={() => deleteComment(c.id)} className="text-destructive hover:underline"><Trash2 className="h-2.5 w-2.5" /></button>
                          </div>
                        </div>
                        {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                        {c.marksOverride !== null && <p className="text-[10px] text-amber-600 mt-0.5">Score: {c.marksOverride}%</p>}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* === Weekly Test Comment Dialog ===
            Opens when teacher clicks "Comment" on a weekly test.
            Shows previous comments for that test, allows writing a new comment
            with an optional grade override, and supports deleting comments. */}
        <Dialog open={wtCommentFor !== null} onOpenChange={(open) => { if (!open) setWtCommentFor(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Week {wtCommentFor?.week} Test — Comments
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Previous comments for this weekly test */}
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Previous comments</p>
                {portfolio.comments.filter(c => c.weeklyTestId === wtCommentFor?.testId).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-2 py-3 rounded bg-muted">No comments yet for this test.</p>
                ) : (
                  <div className="space-y-1.5">
                    {portfolio.comments.filter(c => c.weeklyTestId === wtCommentFor?.testId).map((c) => (
                      <div key={c.id} className="rounded-md bg-muted p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">{c.teacher.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                            <button
                              onClick={() => deleteWtComment(c.id)}
                              className="text-[10px] text-destructive hover:text-destructive/80 hover:underline"
                              title="Delete this comment" aria-label="Delete this comment"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                        {c.marksOverride !== null && (
                          <p className="text-[10px] text-amber-600 mt-1">Grade: {c.marksOverride}%</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New comment composer */}
              <div className="rounded-md border border-border p-3 space-y-2 bg-background">
                <p className="text-[10px] font-medium text-foreground">Add a new comment</p>
                <textarea
                  value={wtCommentBody}
                  onChange={(e) => setWtCommentBody(e.target.value)}
                  placeholder="Write feedback for this weekly test…"
                  className="w-full min-h-20 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground">Grade (optional):</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={wtCommentGrade}
                    onChange={(e) => setWtCommentGrade(e.target.value)}
                    className="w-20 h-7 text-xs bg-muted border-border"
                    placeholder="0-100"
                  />
                  <span className="text-[10px] text-muted-foreground">Leave blank to keep current score</span>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setWtCommentFor(null)} className="h-7 text-xs">Cancel</Button>
                  <Button
                    size="sm"
                    onClick={submitWtComment}
                    disabled={wtPosting || !wtCommentBody.trim()}
                    className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {wtPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Save Comment
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Weekly Test Edit AI Results Dialog ===
            Opens when teacher clicks "Edit AI Results" on a completed weekly test.
            Allows editing the AI-generated score, psychAnalysis, and examinerComment. */}
        <Dialog open={wtEditFor !== null} onOpenChange={(open) => { if (!open) setWtEditFor(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-violet-600" />
                Edit AI Results — Week {wtEditFor?.week}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-[10px] text-muted-foreground italic">
                Use this to correct an unfair AI score, soften a harsh psychological analysis, or rewrite the examiner comment to be more encouraging. The original AI values will be overwritten.
              </p>
              <div>
                <label className="text-[10px] font-medium text-foreground">Score (0-100)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={wtEditScore}
                  onChange={(e) => setWtEditScore(e.target.value)}
                  className="mt-1 bg-muted border-border"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground">Examiner Comment</label>
                <textarea
                  value={wtEditComment}
                  onChange={(e) => setWtEditComment(e.target.value)}
                  className="w-full min-h-24 mt-1 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                  placeholder="The examiner's overall observation of the student…"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground">Psychological Analysis</label>
                <textarea
                  value={wtEditPsych}
                  onChange={(e) => setWtEditPsych(e.target.value)}
                  className="w-full min-h-24 mt-1 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                  placeholder="Psychologist-style cognitive assessment…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setWtEditFor(null)} className="h-7 text-xs">Cancel</Button>
                <Button
                  size="sm"
                  onClick={saveWtEdit}
                  disabled={wtEditSaving}
                  className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {wtEditSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Generic Entity Comment Dialog ===
            Opens when teacher clicks Comment on any entity (check-in, practice, task).
            Shows previous comments + a new comment composer with optional grade. */}
        <Dialog open={entityCommentFor !== null} onOpenChange={(open) => { if (!open) setEntityCommentFor(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Comment — {entityCommentFor?.label || "Entity"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Previous comments for this entity */}
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Previous comments</p>
                {(() => {
                  if (!entityCommentFor) return null;
                  const field = entityCommentFor.type === "dailyLog" ? "dailyLogId"
                    : entityCommentFor.type === "interaction" ? "interactionId"
                    : "taskId";
                  const prev = portfolio.comments.filter(c => c[field as "dailyLogId" | "interactionId" | "taskId"] === entityCommentFor.id);
                  if (prev.length === 0) return <p className="text-xs text-muted-foreground italic px-2 py-3 rounded bg-muted">No comments yet.</p>;
                  return (
                    <div className="space-y-1.5">
                      {prev.map((c) => (
                        <div key={c.id} className="rounded-md bg-muted p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground">{c.teacher.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                              <button onClick={() => deleteComment(c.id)} className="text-destructive hover:text-destructive/80" title="Delete" aria-label="Delete comment"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                          {c.body && <p className="text-foreground/80 break-words">{c.body}</p>}
                          {c.marksOverride !== null && <p className="text-[10px] text-amber-600 mt-1">Score: {c.marksOverride}%</p>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {/* New comment composer */}
              <div className="rounded-md border border-border p-3 space-y-2 bg-background">
                <p className="text-[10px] font-medium text-foreground">Add a new comment</p>
                <textarea
                  value={entityCommentBody}
                  onChange={(e) => setEntityCommentBody(e.target.value)}
                  placeholder="Write feedback…"
                  className="w-full min-h-20 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground">Score (optional):</label>
                  <Input type="number" min="0" max="100" value={entityCommentGrade} onChange={(e) => setEntityCommentGrade(e.target.value)} className="w-20 h-7 text-xs bg-muted border-border" placeholder="0-100" />
                  <span className="text-[10px] text-muted-foreground">Leave blank for no score</span>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEntityCommentFor(null)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={submitEntityComment} disabled={entityPosting || !entityCommentBody.trim()} className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                    {entityPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Save Comment
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Report Card Generation Dialog ===
            Teacher selects a week (1-6) and generates a report card. */}
        <Dialog open={rcDialogOpen} onOpenChange={setRcDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Generate Report Card
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Select which week to generate a report card for:</p>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                  <button
                    key={w}
                    onClick={() => setRcSelectedWeek(String(w))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      rcSelectedWeek === String(w)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Week {w}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setRcDialogOpen(false)} className="h-7 text-xs">Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => generateReportCard(student.id, Number(rcSelectedWeek))}
                  disabled={rcGenerating || !rcSelectedWeek}
                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {rcGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                  Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Report Card Edit Dialog === */}
        <Dialog open={rcEditFor !== null} onOpenChange={(open) => { if (!open) setRcEditFor(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-violet-600" /> Edit Report Card — Week {rcEditFor}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-foreground">Grade</label>
                  <Select value={rcEditGrade} onValueChange={setRcEditGrade}>
                    <SelectTrigger className="mt-1 bg-muted border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A (90-100)</SelectItem>
                      <SelectItem value="B">B (80-89)</SelectItem>
                      <SelectItem value="C">C (70-79)</SelectItem>
                      <SelectItem value="D">D (60-69)</SelectItem>
                      <SelectItem value="F">F (below 60)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-foreground">Score (0-100)</label>
                  <Input type="number" min="0" max="100" value={rcEditScore} onChange={(e) => setRcEditScore(e.target.value)} className="mt-1 bg-muted border-border h-8 text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground">Examiner Observations</label>
                <textarea
                  value={rcEditExaminerObs}
                  onChange={(e) => setRcEditExaminerObs(e.target.value)}
                  className="w-full min-h-24 mt-1 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                  placeholder="Examiner observations…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setRcEditFor(null)} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={saveRcEdit} disabled={rcEditSaving} className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                  {rcEditSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* === Report Cards tab ===
            Shows all generated report cards with edit + comment + generate buttons. */}
        {tab === "report-cards" && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Generate button — opens dialog with week selector */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Report Cards
              </p>
              <Button onClick={() => openReportCardDialog(student.currentWeek)} size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                <FileText className="h-3 w-3" /> Generate New
              </Button>
            </div>

            {portfolio.reportCards.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No report cards yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Click "Generate New" to auto-create a report card from the student's data.</p>
              </div>
            ) : (
              portfolio.reportCards.map((rc) => (
                <div key={rc.week} className="rounded-md bg-muted border border-border p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">Week {rc.week}</Badge>
                      <Badge variant="outline" className={`text-xs font-bold ${gradeColor(rc.grade)}`}>{rc.grade}</Badge>
                      <span className={`text-lg font-bold ${gradeColor(rc.grade)}`}>{rc.score}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openRcEdit(rc.week, rc.grade, rc.score, rc.examinerObservations)} className="rounded p-1 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 transition-colors" title="Edit report card" aria-label="Edit report card">
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setRcCommentFor(rc.week)} className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Comment on this report card" aria-label="Comment on this report card">
                        <MessageSquare className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {/* Strengths */}
                  {(() => {
                    try { return JSON.parse(rc.strengths); } catch { return []; }
                  })().length > 0 && (
                    <div className="mb-1.5">
                      <p className="text-[10px] font-medium text-emerald-600 mb-0.5">Strengths</p>
                      <ul className="text-xs text-foreground/80 list-disc list-inside">
                        {(() => { try { return JSON.parse(rc.strengths); } catch { return []; } })().map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {/* Weaknesses */}
                  {(() => {
                    try { return JSON.parse(rc.weaknesses); } catch { return []; }
                  })().length > 0 && (
                    <div className="mb-1.5">
                      <p className="text-[10px] font-medium text-amber-600 mb-0.5">Weaknesses</p>
                      <ul className="text-xs text-foreground/80 list-disc list-inside">
                        {(() => { try { return JSON.parse(rc.weaknesses); } catch { return []; } })().map((w: string, i: number) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {/* Work habits + progress */}
                  <p className="text-[10px] text-muted-foreground mt-1">{rc.workHabits}</p>
                  <p className="text-[10px] text-muted-foreground">{rc.progress}</p>
                  {/* Examiner observations */}
                  {rc.examinerObservations && (
                    <div className="mt-1.5 rounded-md bg-primary/5 border border-primary/20 p-2">
                      <p className="text-[10px] font-medium text-primary mb-0.5">Examiner Observations</p>
                      <p className="text-xs text-foreground/80 break-words">{rc.examinerObservations}</p>
                    </div>
                  )}
                  {/* Next steps */}
                  {(() => {
                    try { return JSON.parse(rc.nextSteps); } catch { return []; }
                  })().length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-medium text-blue-600 mb-0.5">Next Steps</p>
                      <ul className="text-xs text-foreground/80 list-disc list-inside">
                        {(() => { try { return JSON.parse(rc.nextSteps); } catch { return []; } })().map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {/* Comments on this report card */}
                  {portfolio.comments.filter(c => c.body?.includes(`[Week ${rc.week} Report Card]`)).map(c => (
                    <div key={c.id} className="mt-1.5 rounded-md bg-primary/10 border border-primary/20 p-2 text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-primary">{c.teacher.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => deleteComment(c.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-2.5 w-2.5" /></button>
                        </div>
                      </div>
                      <p className="text-foreground/80 break-words">{c.body?.replace(`[Week ${rc.week} Report Card] `, "")}</p>
                    </div>
                  ))}
                  {/* Inline comment composer — shows under the card when its comment button is clicked */}
                  {rcCommentFor === rc.week && (
                    <div className="mt-1.5 rounded-md border border-primary/30 p-2 space-y-1.5 bg-background">
                      <p className="text-[10px] font-medium text-primary">Add comment on Week {rc.week} report card</p>
                      <textarea
                        value={rcCommentBody}
                        onChange={(e) => setRcCommentBody(e.target.value)}
                        placeholder="Write feedback on this report card…"
                        className="w-full min-h-16 rounded-md bg-muted border border-border p-2 text-xs text-foreground resize-y"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setRcCommentFor(null); setRcCommentBody(""); }} className="h-6 text-[10px]">Cancel</Button>
                        <Button size="sm" onClick={submitRcComment} disabled={!rcCommentBody.trim()} className="h-6 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Send className="h-2.5 w-2.5" /> Post
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Phase Three-Tab Redesign: 'trends' replaced with three clearly-scoped tabs.
            - Psychological: how the student thinks and feels (cognition, confidence, emotional state)
            - Educational: what the student knows and can do (skill mastery, gap specificity)
            - Mentorship: how the student is being supported, and by whom (touchpoints, presence) */}
        {tab === "psychological" && <PsychologicalTab portfolio={portfolio} />}
        {tab === "educational" && <EducationalTab portfolio={portfolio} />}
        {tab === "mentorship" && <MentorshipTabV2 portfolio={portfolio} onCompose={onMessage} />}

        {tab === "comments" && (
          <div className="space-y-3">
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {portfolio.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Add the first one below.</p>
              ) : (
                portfolio.comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-muted p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{c.teacher.name}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    {c.body && <p className="text-foreground/80 text-xs break-words">{c.body}</p>}
                    {c.marksOverride !== null && <p className="text-[10px] text-amber-600 mt-1">Marks override: {c.marksOverride}%</p>}
                    {c.interactionId && <Badge variant="outline" className="text-[9px] mt-1">on assessment</Badge>}
                    {c.taskId && <Badge variant="outline" className="text-[9px] mt-1">on task</Badge>}
                  </div>
                ))
              )}
            </div>
            <div className="rounded-md border border-border p-3 space-y-2 bg-background">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Send className="h-3 w-3" /> Add a comment
              </p>
              <Select value={commentTarget} onValueChange={setCommentTarget}>
                <SelectTrigger className="bg-muted border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General project comment</SelectItem>
                  {portfolio.interactions.slice(0, 5).map((i) => (
                    <SelectItem key={i.id} value={i.id}>On: {i.topic.slice(0, 40)} ({i.correctness}%)</SelectItem>
                  ))}
                  {portfolio.tasks.slice(0, 5).map((t) => (
                    <SelectItem key={t.id} value={`task-${t.id}`}>On task: {t.description.slice(0, 40)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write feedback or improvement suggestions…"
                className="w-full min-h-20 rounded-md bg-muted border border-border p-2 text-sm text-foreground resize-y"
              />
              <Button onClick={submitComment} disabled={posting || !commentBody.trim()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Post Comment
              </Button>
            </div>
          </div>
        )}

        {/* Audit tab — full audit trail. Visible to principal + administrator. */}
        {tab === "audit" && isPrivilegedRole && (
          <UserAuditTab userId={student.id} />
        )}
      </div>
    </div>
  );
}
