"use client";

import { useEffect, useState, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Textarea } from "@/modules/ui/textarea";
import { Badge } from "@/modules/ui/badge";
import { Progress } from "@/modules/ui/progress";
import { scoreToGrade, gradeColor, TEST_QUESTION_COUNT } from "@/lib/constants";
import { showError } from "@/lib/toast-helpers";
import type { WeeklyTest, StatsResponse, Mode } from "@/components/examiner/student/types";
import { PostTestReflection } from "@/components/examiner/student/PostTestReflection";
import { TeachingFeedbackCard, type TeachingFeedback } from "@/components/examiner/student/TeachingFeedbackCard";
import { TestChatUI } from "@/modules/assessment/components/TestChatUI";
import { logger } from "@/lib/logger";
import {
  Brain, Loader2, RefreshCw, ClipboardList, Sparkles, ShieldAlert,
  Send, Circle, CheckCircle2, AlertTriangle,
} from "lucide-react";

export function WeeklyTestPanel({ stats, onReload, onMode }: { stats: StatsResponse; onReload: () => void; onMode: (m: Mode) => void; }) {
  const [selectedWeek, setSelectedWeek] = useState<number>(stats.stats.currentWeek);
  const [userRole, setUserRole] = useState<string>("student");
  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me").then((r) => {
      if (r.user) setUserRole(r.user.role);
    }).catch((err) => { logger.warn("Operation failed", { err }); });
  }, []);
  const isAdmin = ["administrator", "admin", "principal", "institution_admin", "platform_admin", "demo"].includes(userRole);
  // The student's course duration (defaults to 6 if not set — backward compat).
  // Used to detect the final week so the task-lock is bypassed for capstone
  // tests in courses of any length, not just 6-week ones.
  const projectDurationWeeks = stats.stats.projectDurationWeeks ?? 6;
  const isFinalWeek = selectedWeek === projectDurationWeeks;
  const weekTasks = (stats.tasks || []).filter((t) => t.week === selectedWeek);
  // Final week has NO task constraint — open all week (capstone test).
  // Admin bypasses task requirement.
  const allTasksDone = isAdmin || isFinalWeek || weekTasks.length === 0 || weekTasks.every((t) => t.status === "completed");
  const currentTest = (stats.weeklyTests || []).find((t) => t.week === selectedWeek);
  const isCompleted = currentTest?.status === "completed";

  // Chat state
  const [conversation, setConversation] = useState<ChatMsg[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [replyCount, setReplyCount] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [psychAnalysis, setPsychAnalysis] = useState<string | null>(null);
  const [examinerComment, setExaminerComment] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [plagiarismScore, setPlagiarismScore] = useState<number | null>(null);
  // Phase 1.6: weaknesses array for the study plan + needsStudyPlan flag
  // (Phase 1.1: when true, the UI shows a kind message instead of the raw score)
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [needsStudyPlan, setNeedsStudyPlan] = useState(false);
  // Phase 1.2 v2: plagiarism breakdown (per-answer analysis + voice consistency)
  // Phase 1.3 v2: engagement feedback (subject changes + avoidance + constructive advice)
  const [plagiarismNotes, setPlagiarismNotes] = useState<string>("");
  const [plagiarismBreakdown, setPlagiarismBreakdown] = useState<{
    voiceConsistency: string;
    perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
    strongestSignal: string;
    instructorNote: string;
  } | null>(null);
  const [engagementFeedback, setEngagementFeedback] = useState<{
    subjectChanges: number;
    avoidanceCount: number;
    distractedQuestions: number[];
    overallEngagement: string;
    studentFeedback: string;
    instructorNote: string;
  } | null>(null);
  // Teaching feedback — same shape as practice/daily (model answer +
  // missed points + next-time tip). Stored alongside psychAnalysis on
  // the WeeklyTest row, surfaced to the student after completion.
  const [feedback, setFeedback] = useState<TeachingFeedback | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  // Course-configured test length. The server may override this per course
  // (some courses want 8, 10, or 12 questions). Default to TEST_QUESTION_COUNT.weekly
  // (single source of truth) so the UI never disagrees with the constants file.
  const [totalQuestions, setTotalQuestions] = useState<number>(TEST_QUESTION_COUNT.weekly);
  const [maxReplies, setMaxReplies] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  interface ChatMsg {
    role: "examiner" | "student";
    content: string;
    timestamp: string;
    questionIndex: number;
  }

  // Load existing test state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          conversation: ChatMsg[];
          currentQuestion: number;
          replyCount: number;
          isComplete: boolean;
          totalQuestions?: number;
          maxReplies?: number;
          test: {
            psychAnalysis: string | null;
            examinerComment: string | null;
            score: number | null;
            status: string;
            plagiarismScore?: number | null;
            weaknesses?: string[];
            needsStudyPlan?: boolean;
            plagiarismNotes?: string;
            plagiarismBreakdown?: {
              voiceConsistency: string;
              perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
              strongestSignal: string;
              instructorNote: string;
            } | null;
            engagementFeedback?: {
              subjectChanges: number;
              avoidanceCount: number;
              distractedQuestions: number[];
              overallEngagement: string;
              studentFeedback: string;
              instructorNote: string;
            } | null;
            feedback?: TeachingFeedback;
          } | null;
        }>(`/api/ai/weekly-test?week=${selectedWeek}`);
        if (cancelled) return;
        setConversation(res.conversation || []);
        setCurrentQuestion(res.currentQuestion || 0);
        setReplyCount(res.replyCount || 0);
        setIsComplete(res.isComplete);
        // Read course-configured test length from the API response (was hardcoded)
        if (res.totalQuestions) setTotalQuestions(res.totalQuestions);
        if (res.maxReplies) setMaxReplies(res.maxReplies);
        if (res.test) {
          setPsychAnalysis(res.test.psychAnalysis);
          setExaminerComment(res.test.examinerComment);
          setScore(res.test.score);
          setPlagiarismScore(res.test.plagiarismScore ?? null);
          // Phase 1.6: load weaknesses + needsStudyPlan flag
          setWeaknesses(res.test.weaknesses ?? []);
          setNeedsStudyPlan(res.test.needsStudyPlan ?? false);
          // Phase 1.2 v2 + 1.3 v2: load the full analysis breakdown
          setPlagiarismNotes(res.test.plagiarismNotes ?? "");
          setPlagiarismBreakdown(res.test.plagiarismBreakdown ?? null);
          setEngagementFeedback(res.test.engagementFeedback ?? null);
          setFeedback(res.test.feedback ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChatLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWeek]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, busy]);

  const startTest = async () => {
    setBusy(true);
    try {
      const res = await api.post<{
        conversation: ChatMsg[];
        currentQuestion: number;
        replyCount: number;
        isComplete: boolean;
        totalQuestions?: number;
        maxReplies?: number;
      }>('/api/ai/weekly-test', { week: selectedWeek, action: 'start' }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setCurrentQuestion(res.currentQuestion);
      setReplyCount(res.replyCount);
      setIsComplete(false);
      // Read course-configured test length from the API response
      if (res.totalQuestions) setTotalQuestions(res.totalQuestions);
      if (res.maxReplies) setMaxReplies(res.maxReplies);
      setPsychAnalysis(null);
      setExaminerComment(null);
      setScore(null);
      setPlagiarismScore(null);
      setFeedback(null);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to start test");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!input.trim() || busy || isComplete) return;
    const msg = input.trim();
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{
        conversation: ChatMsg[];
        currentQuestion: number;
        replyCount: number;
        isComplete: boolean;
        psychAnalysis?: string;
        examinerComment?: string;
        score?: number;
        plagiarismScore?: number;
        weaknesses?: string[];
        plagiarismNotes?: string;
        plagiarismBreakdown?: {
          voiceConsistency: string;
          perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
          strongestSignal: string;
          instructorNote: string;
        } | null;
        engagementFeedback?: {
          subjectChanges: number;
          avoidanceCount: number;
          distractedQuestions: number[];
          overallEngagement: string;
          studentFeedback: string;
          instructorNote: string;
        } | null;
        feedback?: TeachingFeedback;
      }>("/api/ai/weekly-test", { week: selectedWeek, action: "reply", message: msg }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setCurrentQuestion(res.currentQuestion);
      setReplyCount(res.replyCount);
      if (res.isComplete) {
        setIsComplete(true);
        setPsychAnalysis(res.psychAnalysis ?? null);
        setExaminerComment(res.examinerComment ?? null);
        setScore(res.score ?? null);
        setPlagiarismScore(res.plagiarismScore ?? null);
        // Phase 1.6: capture weaknesses + compute needsStudyPlan
        setWeaknesses(res.weaknesses ?? []);
        setNeedsStudyPlan((res.score ?? 100) < 60);
        // Phase 1.2 v2 + 1.3 v2: capture the full analysis breakdown
        setPlagiarismNotes(res.plagiarismNotes ?? "");
        setPlagiarismBreakdown(res.plagiarismBreakdown ?? null);
        setEngagementFeedback(res.engagementFeedback ?? null);
        setFeedback(res.feedback ?? null);
        onReload();
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      // Auto-focus the input so the student can type their next reply
      // without having to click the textarea again.
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const finishEarly = async () => {
    if (!confirm("Finish the test early? Your assessment will be based on replies so far.")) return;
    setBusy(true);
    try {
      const res = await api.post<{
        conversation: ChatMsg[];
        isComplete: boolean;
        psychAnalysis: string;
        examinerComment: string;
        score: number;
        weaknesses?: string[];
        plagiarismNotes?: string;
        plagiarismBreakdown?: {
          voiceConsistency: string;
          perAnswerFlags: { questionIndex: number; flagged: boolean; reason: string }[];
          strongestSignal: string;
          instructorNote: string;
        } | null;
        engagementFeedback?: {
          subjectChanges: number;
          avoidanceCount: number;
          distractedQuestions: number[];
          overallEngagement: string;
          studentFeedback: string;
          instructorNote: string;
        } | null;
        feedback?: TeachingFeedback;
      }>("/api/ai/weekly-test", { week: selectedWeek, action: "finish" }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setIsComplete(true);
      setPsychAnalysis(res.psychAnalysis);
      setExaminerComment(res.examinerComment);
      setScore(res.score);
      // Phase 1.6: capture weaknesses + compute needsStudyPlan
      setWeaknesses(res.weaknesses ?? []);
      setNeedsStudyPlan(res.score < 60);
      // Phase 1.2 v2 + 1.3 v2: capture the full analysis breakdown
      setPlagiarismNotes(res.plagiarismNotes ?? "");
      setPlagiarismBreakdown(res.plagiarismBreakdown ?? null);
      setEngagementFeedback(res.engagementFeedback ?? null);
      setFeedback(res.feedback ?? null);
      onReload();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const hasStarted = conversation.length > 0;

  return (
    <div className="space-y-4">
      {/* Week selector — student can pick any week */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Select week:</span>
        {Array.from({ length: stats.stats.projectDurationWeeks ?? 6 }, (_, i) => i + 1).map(w => {
          const test = (stats.weeklyTests || []).find(t => t.week === w);
          const isDone = test?.status === "completed";
          return (
            <button
              key={w}
              onClick={() => { setSelectedWeek(w); setConversation([]); setChatLoaded(false); setIsComplete(false); setPsychAnalysis(""); setExaminerComment(""); setScore(null); setFeedback(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedWeek === w
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDone
                  ? "border-growth-sage text-growth-sage bg-growth-sage-soft hover:bg-growth-sage/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              W{w}{isDone && " ✓"}
            </button>
          );
        })}
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Weekly Test — Week {selectedWeek}
            {isFinalWeek && <Badge variant="outline" className="text-[10px] text-growth-amber border-growth-amber bg-growth-amber-soft">Final Capstone — No task lock</Badge>}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            A Socratic conversation with the AI examiner. {totalQuestions} questions, max {maxReplies} replies each.
            Graded on concept understanding and logical reasoning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allTasksDone && !isCompleted && !hasStarted ? (
            <div className="rounded-md bg-growth-amber-soft border border-growth-amber p-4">
              <p className="text-growth-amber-foreground dark:text-growth-amber flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Complete all Week {selectedWeek} tasks first to unlock the test.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {weekTasks.filter(t => t.status === "completed").length} of {weekTasks.length} tasks completed. Go to the Project tab and mark the remaining tasks as "completed".
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {[...weekTasks].sort((a, b) => {
                  const dayA = a.day ?? 99;
                  const dayB = b.day ?? 99;
                  return dayA - dayB;
                }).map((t) => (
                  <li key={t.id} className={`flex items-center gap-2 ${t.status === "completed" ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {t.status === "completed"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-growth-sage flex-shrink-0" />
                      : <Circle className="h-3.5 w-3.5 text-growth-amber flex-shrink-0" />}
                    <span className={t.status === "completed" ? "line-through" : ""}>{t.description}</span>
                    {t.status !== "completed" && <Badge variant="outline" className="text-[9px] text-growth-amber border-growth-amber ml-auto">{t.status}</Badge>}
                  </li>
                ))}
              </ul>
              <Button onClick={() => onMode("gantt")} variant="outline" size="sm" className="mt-3 border-growth-amber text-growth-amber">
                Go to Project →
              </Button>
            </div>
          ) : !hasStarted && !isCompleted ? (
            <div className="text-center py-8 space-y-4">
              <Brain className="h-12 w-12 text-primary mx-auto" />
              <div>
                <p className="text-foreground font-medium">Ready to begin your Socratic assessment</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The AI examiner will ask you {totalQuestions} questions across 4 pillars (Why Probe, Break-It, Client Translation, Edge Case) plus reflections.
                  Each question allows up to {maxReplies} replies. You&apos;ll be graded on concept understanding and logical reasoning — not word count.
                  Be concise and thoughtful.
                </p>
              </div>
              <Button onClick={startTest} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                Start Socratic Test
              </Button>
            </div>
          ) : !chatLoaded ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isComplete ? (
            /* COMPLETED STATE — show only the results, NOT the empty chat window.
               This avoids the blank 420px box that used to render below the
               results card when a test was already completed.
               Phase 1.1: When needsStudyPlan is true (score < 60), the student
               sees a kind "here's what to focus on" message + study plan instead
               of the raw score. Teachers see the real score in the portfolio view. */
            <div className="space-y-3 animate-fade-in-up">
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">
                    {needsStudyPlan ? "Test Complete — Let's Look at This Together" : "Test Complete"}
                  </span>
                  {/* Phase 1.1: Only show the raw score if the student passed
                      (score >= 60). For lower scores, show a kind message
                      instead — the student doesn't need to see "32%" staring
                      at them. The instructor sees the real score. */}
                  {score !== null && !needsStudyPlan && (
                    <span className="text-2xl font-bold text-primary">{score}%</span>
                  )}
                  {score !== null && needsStudyPlan && (
                    <span className="text-2xl font-bold text-growth-amber">Keep Going</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">Based on {currentQuestion + 1} questions answered</p>

                {/* Phase 1.1 + 1.6: Study plan for low scores. Replaces the
                    harsh "you failed" feeling with actionable guidance. */}
                {needsStudyPlan && (
                  <div className="rounded-md p-3 mb-3 bg-growth-amber-soft border border-growth-amber">
                    {/* SDT: Lead with the strength, then offer the gap as a choice */}
                    <p className="text-sm font-medium text-growth-sage-foreground dark:text-growth-sage mb-1">
                      What you're already doing well:
                    </p>
                    <p className="text-xs text-foreground/80 mb-3">
                      You showed up and engaged with every question — that's the foundation everything else builds on. Showing up consistently is the hardest part, and you're already doing it.
                    </p>
                    <p className="text-sm font-medium text-growth-amber-foreground dark:text-growth-amber mb-1">
                      Want to strengthen these areas?
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Here are some topics worth a closer look. You decide how to approach them —
                      try one practice question, ask the AI Tutor, or take a first pass on your own.
                    </p>
                    {weaknesses.length > 0 && (
                      <ul className="space-y-1 mt-2">
                        {weaknesses.map((w, i) => (
                          <li key={i} className="text-xs text-foreground flex items-start gap-2">
                            <span className="text-growth-amber mt-0.5">→</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      Try this: next time you open the app, start with one practice question on {weaknesses[0] || "any topic"} before anything else. Just one — it takes 2 minutes.
                    </p>
                  </div>
                )}

                {/* Plagiarism / cheating detection — moved to the enhanced card
                    below (after psychAnalysis) so the student sees the full
                    breakdown (voice analysis, key pattern) instead of just a
                    bare score. See "Academic Integrity Note" card below. */}
                {examinerComment && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-primary mb-1">Examiner&apos;s Observation</p>
                    <p className="text-sm text-foreground">{examinerComment}</p>
                  </div>
                )}
              </div>
              {psychAnalysis && (
                <div className="rounded-lg border border-border bg-muted p-4">
                  <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                    <Brain className="h-3 w-3" /> How You Think
                  </p>
                  <p className="text-sm text-foreground/80">{psychAnalysis}</p>
                </div>
              )}

              {/* Phase 1.3 v2: Engagement & Focus Feedback — constructive professional
                  advice shown to the student. Helps them build career-ready habits
                  (staying on topic, attempting answers, engaging fully). */}
              {engagementFeedback && engagementFeedback.studentFeedback && (
                <div className={`rounded-lg border p-4 ${
                  engagementFeedback.overallEngagement === "high"
                    ? "border-growth-sage bg-growth-sage-soft"
                    : engagementFeedback.overallEngagement === "low"
                    ? "border-growth-amber bg-growth-amber-soft"
                    : "border-border bg-muted"
                }`}>
                  <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Engagement &amp; Focus Feedback
                  </p>
                  {/* Quick stats row */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className={`text-[10px] ${engagementFeedback.subjectChanges > 0 ? "border-growth-amber text-growth-amber" : "border-growth-sage text-growth-sage"}`}>
                      {engagementFeedback.subjectChanges} subject change{engagementFeedback.subjectChanges === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${engagementFeedback.avoidanceCount > 0 ? "border-growth-amber text-growth-amber" : "border-growth-sage text-growth-sage"}`}>
                      {engagementFeedback.avoidanceCount} avoidance{engagementFeedback.avoidanceCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${engagementFeedback.overallEngagement === "high" ? "border-growth-sage text-growth-sage" : engagementFeedback.overallEngagement === "low" ? "border-growth-amber text-growth-amber" : "border-border text-muted-foreground"}`}>
                      Engagement: {engagementFeedback.overallEngagement}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/80">{engagementFeedback.studentFeedback}</p>
                </div>
              )}

              {/* Plagiarism score — NOW SHOWN TO STUDENTS with mark deduction */}
              {plagiarismScore !== null && (
                <div className={`rounded-lg border p-4 ${
                  plagiarismScore > 70 ? "border-destructive/30 bg-destructive/5"
                  : plagiarismScore > 40 ? "border-growth-amber bg-growth-amber-soft"
                  : plagiarismScore > 10 ? "border-lime-500/30 bg-lime-500/5"
                  : "border-growth-sage bg-growth-sage-soft"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Academic Integrity
                    </p>
                    <Badge variant="outline" className={`text-[10px] ${
                      plagiarismScore > 70 ? "bg-destructive/5 text-destructive border-destructive/30"
                      : plagiarismScore > 40 ? "bg-growth-amber-soft text-growth-amber border-growth-amber"
                      : plagiarismScore > 10 ? "bg-growth-sage-soft text-growth-sage border-growth-sage"
                      : "bg-growth-sage-soft text-growth-sage border-growth-sage"
                    }`}>
                      Plagiarism: {plagiarismScore}%
                    </Badge>
                  </div>

                  {/* Score deduction breakdown */}
                  {plagiarismScore > 0 && score !== null && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-xs">
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-[9px] text-muted-foreground">Raw Score</p>
                        <p className="text-sm font-bold text-foreground">{plagiarismScore > 0 ? Math.round(score / (1 - plagiarismScore / 100)) : score}%</p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-[9px] text-muted-foreground">Plagiarism</p>
                        <p className="text-sm font-bold text-growth-amber">{plagiarismScore}%</p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-[9px] text-muted-foreground">Marks Deducted</p>
                        <p className="text-sm font-bold text-destructive">-{Math.round((plagiarismScore > 0 ? Math.round(score / (1 - plagiarismScore / 100)) : score) * plagiarismScore / 100)}</p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-[9px] text-muted-foreground">Final Score</p>
                        <p className="text-sm font-bold text-foreground">{score}%</p>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-foreground/80">
                    {plagiarismScore <= 10
                      ? "Your answers are genuinely your own work. No marks deducted."
                      : plagiarismScore <= 30
                      ? "Mostly your own work. Minor concerns — a small deduction was applied."
                      : plagiarismScore <= 50
                      ? "Some answers may need review. Marks have been deducted based on the plagiarism percentage."
                      : plagiarismScore <= 70
                      ? "Likely used AI on multiple answers. Significant marks deducted."
                      : "Very likely cheated on several answers. Heavy marks deducted."}
                  </p>
                  {plagiarismNotes && plagiarismScore > 30 && (
                    <p className="text-xs text-muted-foreground mt-1">{plagiarismNotes}</p>
                  )}
                  {plagiarismScore > 10 && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      Deduction formula: Final = Raw × (1 − Plagiarism%÷100). 100% plagiarism = 0 marks.
                    </p>
                  )}
                </div>
              )}

              {/* Retake button ONLY shows if the instructor has explicitly allowed it.
                  Otherwise the student sees the results only — no retake option. */}
              {currentTest?.retakeAllowed && (
                <Button onClick={() => { if (confirm("Retake the test? Your previous result will be replaced.")) startTest(); }} variant="outline" className="border-growth-amber text-growth-amber hover:bg-growth-amber-soft">
                  <RefreshCw className="h-4 w-4" /> Retake Test (instructor-approved)
                </Button>
              )}
              {!currentTest?.retakeAllowed && (
                <p className="text-xs text-muted-foreground italic">
                  Test locked. Ask your instructor if you need to retake this test.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Shared TestChatUI — same professional chat as daily + practice */}
              {!isComplete && (
                <TestChatUI
                  conversation={conversation}
                  input={input}
                  onInputChange={setInput}
                  onSend={sendReply}
                  onEndEarly={finishEarly}
                  busy={busy}
                  currentQuestion={currentQuestion}
                  questionCountLabel={`This weekly test asks ${totalQuestions} questions`}
                  maxHeight="420px"
                />
              )}

              {/* Results — only show inline results during/after live test, not for already-completed tests */}
              {isComplete && (
                <div className="space-y-3 animate-fade-in-up">
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary">Test Complete</span>
                      {score !== null && (
                        <span className="text-2xl font-bold text-primary">{score}%</span>
                      )}
                    </div>
                    {examinerComment && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-primary mb-1">Examiner&apos;s Observation</p>
                        <p className="text-sm text-foreground">{examinerComment}</p>
                      </div>
                    )}
                  </div>
                  {psychAnalysis && (
                    <div className="rounded-lg border border-border bg-muted p-4">
                      <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                        <Brain className="h-3 w-3" /> How You Think
                      </p>
                      <p className="text-sm text-foreground/80">{psychAnalysis}</p>
                    </div>
                  )}
                  {currentTest?.retakeAllowed && (
                    <Button onClick={() => { if (confirm("Retake the test? Your previous result will be replaced.")) startTest(); }} variant="outline" className="border-growth-amber text-growth-amber hover:bg-growth-amber-soft">
                      <RefreshCw className="h-4 w-4" /> Retake Test (instructor-approved)
                    </Button>
                  )}
                  {/* Post-test reflection — "testing as learning" */}
                  {score !== null && <PostTestReflection score={score} testType="weekly_test" />}
                  {/* Teaching feedback — same model answer + missed points +
                      next-time tip card as practice & daily tests. */}
                  <TeachingFeedbackCard feedback={feedback} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(stats.weeklyTests || []).length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base text-foreground">Test History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats.weeklyTests || []).map((t) => (
                <div key={t.week} className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                  <span className="text-foreground">Week {t.week}</span>
                  <Badge variant="outline" className="capitalize">{t.status}</Badge>
                  <span className={`font-bold ${t.score !== null ? gradeColor(scoreToGrade(t.score)) : "text-muted-foreground"}`}>
                    {t.score !== null ? `${t.score}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
