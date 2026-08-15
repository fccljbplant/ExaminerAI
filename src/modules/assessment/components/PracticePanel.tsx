"use client";

import { toast } from "sonner";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import { Badge } from "@/modules/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/ui/select";
import { Progress } from "@/modules/ui/progress";
import { cn } from "@/lib/utils";
import { getBootcampDayNumber } from "@/lib/course-topics";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import type {
  Stats, WeeklyTest, Competency, ReportCardRow, DailyLog, Task,
  Interaction, CommentRow, StatsResponse, Mode, JourneyStep,
} from "@/modules/assessment/types";
import { PostTestReflection } from "@/modules/assessment/components/PostTestReflection";
import { TeachingFeedbackCard, type TeachingFeedback } from "@/modules/assessment/components/TeachingFeedbackCard";
import { TestChatUI } from "@/modules/assessment/components/TestChatUI";

export function QuestionPanel({ currentWeek, onAnswered, stats }: { currentWeek: number; onAnswered: () => void; stats: StatsResponse }) {
  // Socratic practice conversation — mirrors the daily/weekly test format.
  // The examiner asks, the student answers, the examiner probes, then concludes.
  // This replaces the old single-question form (generate → answer → evaluate).

  const [topic, setTopic] = useState("");
  const [weekTopics, setWeekTopics] = useState<string[]>([]);
  const [weekPhase, setWeekPhase] = useState("");
  const [weekLoading, setWeekLoading] = useState(true);
  const [totalWeeks, setTotalWeeks] = useState(6);
  const todayDay = getBootcampDayNumber(new Date());

  // Week selector — defaults to the student's current week, but the student
  // can pick ANY week in the course to practice on. This lets them review
  // past weeks or preview upcoming material.
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // Conversation state
  const [conversation, setConversation] = useState<Array<{ role: "student" | "examiner"; content: string; timestamp: string }>>([]);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [maxExchanges] = useState(3);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<TeachingFeedback | null>(null);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch week topics — re-fetches when the student changes the week selector
  useEffect(() => {
    let cancelled = false;
    setWeekLoading(true);
    api.get<{ topicTitles: string[]; phase: string; totalWeeks: number }>(`/api/courses/user/week?week=${selectedWeek}`)
      .then((res) => {
        if (cancelled) return;
        setWeekTopics(res.topicTitles || []);
        setWeekPhase(res.phase || `Week ${selectedWeek}`);
        setTotalWeeks(res.totalWeeks || 6);
        // Default to today's topic IF the student is on their current week;
        // otherwise default to Day 1's topic for the selected week.
        const isCurrentWeek = selectedWeek === currentWeek;
        const defaultIdx = isCurrentWeek ? todayDay - 1 : 0;
        setTopic(res.topicTitles?.[defaultIdx] || res.topicTitles?.[0] || "");
      })
      .catch(() => { if (!cancelled) { setWeekTopics([]); setWeekPhase(`Week ${selectedWeek}`); } })
      .finally(() => { if (!cancelled) setWeekLoading(false); });
    return () => { cancelled = true; };
  }, [selectedWeek, currentWeek, todayDay]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation, busy]);

  const startPractice = async () => {
    if (!topic.trim()) return;
    setBusy(true); setStarted(true);
    setConversation([]); setExchangeCount(0); setIsComplete(false); setScore(null);
    try {
      const res = await api.post<{
        conversation: Array<{ role: "student" | "examiner"; content: string; timestamp: string }>;
        topic: string; week: number; exchangeCount: number; maxExchanges: number;
      }>("/api/ai/practice", { action: "start", topic, week: selectedWeek }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setExchangeCount(res.exchangeCount);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start practice");
      setStarted(false);
    } finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!input.trim() || busy) return;
    const msg = input.trim();
    setInput("");
    setBusy(true);

    try {
      const res = await api.post<{
        conversation: Array<{ role: "student" | "examiner"; content: string; timestamp: string }>;
        isComplete: boolean; score?: number; exchangeCount: number;
        feedback?: TeachingFeedback;
      }>("/api/ai/practice", {
        action: "reply",
        topic,
        week: selectedWeek,
        conversation,
        exchangeCount,
        studentReply: msg,
      }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setExchangeCount(res.exchangeCount);
      if (res.isComplete) {
        setIsComplete(true);
        setScore(res.score ?? null);
        setFeedback(res.feedback ?? null);
        onAnswered();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const finishEarly = async () => {
    if (!confirm("End this practice session early?")) return;
    setBusy(true);
    try {
      const res = await api.post<{
        conversation: Array<{ role: "student" | "examiner"; content: string; timestamp: string }>;
        isComplete: boolean; score: number;
        feedback?: TeachingFeedback;
      }>("/api/ai/practice", {
        action: "finish", topic, week: selectedWeek, conversation, exchangeCount,
      }, AI_TIMEOUT_MS);
      setConversation(res.conversation);
      setIsComplete(true);
      setScore(res.score);
      setFeedback(res.feedback ?? null);
      onAnswered();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setStarted(false); setConversation([]); setExchangeCount(0);
    setIsComplete(false); setScore(null); setFeedback(null); setInput("");
  };

  return (
    <div className="space-y-4">
      <Card className="border-line bg-surface">
        <CardHeader>
          <CardTitle className="text-fg flex items-center gap-2"><HelpCircle className="h-5 w-5 text-secondary-foreground" /> Practice Conversation</CardTitle>
          <CardDescription className="text-fg-muted">
            Pick any week + daily topic and have a Socratic conversation with the AI examiner — same format as the weekly test, just shorter ({maxExchanges} exchanges).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week + Topic selector — only shown before starting */}
          {!started && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Week selector — student can pick ANY week in the course */}
                <div className="space-y-1.5">
                  <Label className="text-fg">Week</Label>
                  <Select
                    value={String(selectedWeek)}
                    onValueChange={(v) => setSelectedWeek(Number(v))}
                    disabled={weekLoading}
                  >
                    <SelectTrigger className="bg-bg-subtle border-line">
                      <SelectValue placeholder="Select week…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                        <SelectItem key={w} value={String(w)}>
                          Week {w}{w === currentWeek ? " (current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic selector — daily topics for the selected week */}
                <div className="space-y-1.5">
                  <Label className="text-fg">Daily topic</Label>
                  <Select value={topic} onValueChange={setTopic} disabled={weekLoading || weekTopics.length === 0}>
                    <SelectTrigger className="bg-bg-subtle border-line">
                      <SelectValue placeholder={weekLoading ? "Loading…" : "Pick a topic…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {weekTopics.filter(wt => wt && wt.trim()).map((wt, i) => (
                        <SelectItem key={i} value={wt}>
                          Day {i + 1}{selectedWeek === currentWeek && i + 1 === todayDay ? " (today)" : ""}: {wt.length > 50 ? wt.slice(0, 50) + "…" : wt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-fg-muted">
                Practicing on <strong>Week {selectedWeek} · {weekPhase}</strong>. The AI will ask you a conceptual question about <strong>{topic || "the selected topic"}</strong>, then probe your understanding with follow-ups.
              </p>
              <Button onClick={startPractice} disabled={busy || !topic.trim()} className="bg-brand hover:bg-brand/90 text-on-brand">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Start Practice
              </Button>
            </>
          )}

          {/* Conversation — chat UI like the daily test */}
          {started && conversation.length > 0 && !isComplete && (
            <TestChatUI
              conversation={conversation}
              input={input}
              onInputChange={setInput}
              onSend={sendReply}
              onEndEarly={finishEarly}
              busy={busy}
              currentQuestion={exchangeCount > 0 ? exchangeCount - 1 : 0}
              questionCountLabel={`This practice asks ${maxExchanges} questions`}
              topicBadge={topic}
            />
          )}

          {/* Result */}
          {isComplete && (
            <>
              <div className="text-center py-4 animate-success-burst">
                <CheckCircle2 className="h-10 w-10 text-growth-sage mx-auto mb-2" />
                <p className="text-sm font-medium text-fg">Practice complete!</p>
                {score !== null && <p className="text-3xl font-bold text-fg mt-1">{score}%</p>}
              </div>
              {/* Show the full conversation for review */}
              <div className="max-h-[30vh] overflow-y-auto space-y-2 rounded-md bg-bg-subtle/30 p-3">
                {conversation.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "student" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs",
                      m.role === "student" ? "bg-brand text-on-brand" : "bg-bg-subtle text-fg")}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              {score !== null && <PostTestReflection score={score} testType="practice" />}
              <TeachingFeedbackCard feedback={feedback} />
              <Button onClick={reset} variant="outline" size="sm" className="border-line">New practice</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
