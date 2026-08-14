"use client";

/**
 * DailyTestPanel — Socratic conversation, 2-3 questions.
 *
 * Mirrors the weekly test format (examiner asks, student answers, examiner
 * probes, advances) but shorter. Feeds the same analysis pipeline so the
 * Psychological / Educational / Mentorship tabs update daily.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Loader2, Send, CheckCircle2, CalendarCheck, Brain, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostTestReflection } from "@/modules/assessment/components/PostTestReflection";
import { TeachingFeedbackCard, type TeachingFeedback } from "@/modules/assessment/components/TeachingFeedbackCard";
import { TestChatUI } from "@/modules/assessment/components/TestChatUI";

interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex: number;
}

interface TestStatus {
  id: string;
  status: string;
  score: number | null;
  topic: string;
  questionCount: number;
}

export function DailyTestPanel() {
  const [todays, setTodays] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [dailyTestId, setDailyTestId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [replyCount, setReplyCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [maxReplies, setMaxReplies] = useState(2);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<TeachingFeedback | null>(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  // Confidence rating captured BEFORE each answer — feeds the Dunning-Kruger
  // calibration chart on the teacher's Psychological tab.
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post<{ todaysTest: TestStatus | null }>("/api/daily-test", { action: "status" });
      setTodays(res.todaysTest || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load daily test status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, busy]);

  const start = async () => {
    setStarting(true); setError("");
    try {
      const res = await api.post<{
        dailyTestId: string; conversation: ChatMessage[];
        currentQuestion: number; replyCount: number;
        totalQuestions: number; maxReplies: number;
        topic: string; week: number;
      }>("/api/daily-test", { action: "start" }, AI_TIMEOUT_MS);
      setDailyTestId(res.dailyTestId);
      setConversation(res.conversation || []);
      setCurrentQuestion(res.currentQuestion);
      setReplyCount(res.replyCount);
      setTotalQuestions(res.totalQuestions);
      setMaxReplies(res.maxReplies);
      setTopic(res.topic);
      setIsComplete(false);
      setScore(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start daily test");
    } finally { setStarting(false); }
  };

  const sendReply = async () => {
    if (!dailyTestId || !input.trim() || busy) return;
    const msg = input.trim();
    const currentConfidence = confidence; // capture before reset
    setInput("");
    setConfidence("medium"); // reset for next answer
    setError("");
    setBusy(true);

    // Optimistically add the student's message
    const studentMsg: ChatMessage = {
      role: "student", content: msg,
      timestamp: new Date().toISOString(), questionIndex: currentQuestion,
    };
    setConversation(prev => [...prev, studentMsg]);

    try {
      const res = await api.post<{
        conversation: ChatMessage[];
        currentQuestion: number; replyCount: number;
        isComplete: boolean; score?: number;
        feedback?: TeachingFeedback;
        celebration?: {
          xpAwarded: number;
          newTotal: number;
          level: number | null;
          levelLabel: string | null;
          badges: Array<{ id: string; name: string; icon: string; description: string }>;
        };
      }>("/api/daily-test", {
        action: "reply",
        dailyTestId,
        studentReply: msg,
        confidenceRating: currentConfidence,
      }, AI_TIMEOUT_MS);
      setConversation(res.conversation || []);
      setCurrentQuestion(res.currentQuestion);
      setReplyCount(res.replyCount);
      if (res.isComplete) {
        setIsComplete(true);
        setScore(res.score ?? null);
        setFeedback(res.feedback ?? null);
        // Fire celebration animations if XP/badges were awarded
        if (res.celebration) {
          import("@/hooks/use-celebration").then(({ fireCelebrations }) => {
            fireCelebrations(res.celebration!);
          });
        }
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reply");
      // Remove the optimistic message on failure
      setConversation(prev => prev.filter(m => m !== studentMsg));
    } finally { setBusy(false); }
  };

  const finishEarly = async () => {
    if (!dailyTestId || busy) return;
    if (!confirm("End the daily test early? You'll be graded on what you've answered so far.")) return;
    setBusy(true); setError("");
    try {
      const res = await api.post<{
        conversation: ChatMessage[];
        isComplete: boolean;
        score: number;
        feedback?: TeachingFeedback;
        celebration?: {
          xpAwarded: number;
          newTotal: number;
          level: number | null;
          levelLabel: string | null;
          badges: Array<{ id: string; name: string; icon: string; description: string }>;
        };
      }>(
        "/api/daily-test",
        { action: "finish", dailyTestId },
        AI_TIMEOUT_MS,
      );
      setConversation(res.conversation || []);
      setIsComplete(true);
      setScore(res.score);
      setFeedback(res.feedback ?? null);
      // Fire celebration animations if XP/badges were awarded
      if (res.celebration) {
        import("@/hooks/use-celebration").then(({ fireCelebrations }) => {
          fireCelebrations(res.celebration!);
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finish test");
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
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" /> Daily Check-in Test
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Short 3-question Socratic test — same format as the weekly test, just shorter. Sharpens your mastery data daily.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div className="text-xs text-destructive bg-destructive/5 rounded-md p-2">{error}</div>}

        {/* Already completed today */}
        {todays?.status === "completed" && !dailyTestId && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 text-growth-sage mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Today's daily test complete!</p>
            <p className="text-xl font-bold text-foreground mt-1">{todays.score ?? "—"}%</p>
            <p className="text-[10px] text-muted-foreground mt-2">Come back tomorrow for the next one.</p>
          </div>
        )}

        {/* Result card after completion */}
        {isComplete && score !== null && (
          <>
            <div className="text-center py-4 animate-success-burst">
              <CheckCircle2 className="h-10 w-10 text-growth-sage mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Daily test complete!</p>
              <p className="text-3xl font-bold text-foreground mt-1">{score}%</p>
              <Button onClick={() => {
                setIsComplete(false); setConversation([]); setDailyTestId(null); setScore(null); setFeedback(null);
              }} variant="outline" size="sm" className="mt-3 border-border">
                Done
              </Button>
            </div>
            {/* Teaching feedback — what a strong answer looked like +
                what was missed + next-time tip. Tests are learning tools,
                not just grades. */}
            <TeachingFeedbackCard feedback={feedback} />
            {/* Post-test reflection — "testing as learning" */}
            <PostTestReflection score={score} testType="daily_test" />
          </>
        )}

        {/* Start screen */}
        {!todays && !conversation.length && !isComplete && (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground mb-3">
              A quick 3-question Socratic check-in. The examiner asks, you answer, they probe once, then advance.
              Takes about 3-5 minutes. Feeds your Psychological / Educational / Mentorship tabs with fresh data.
            </p>
            <Button onClick={start} disabled={starting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Start today's test
            </Button>
          </div>
        )}

        {/* Socratic conversation — shared TestChatUI */}
        {conversation.length > 0 && !isComplete && (
          <TestChatUI
            conversation={conversation}
            input={input}
            onInputChange={setInput}
            onSend={sendReply}
            onEndEarly={finishEarly}
            busy={busy}
            currentQuestion={currentQuestion}
            questionCountLabel={`This daily test asks ${totalQuestions} questions`}
            topicBadge={topic}
            confidenceSelector={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground flex-shrink-0">Your confidence:</span>
                {(["low", "medium", "high"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setConfidence(c)}
                    disabled={busy}
                    className={cn(
                      "px-2 py-0.5 text-[10px] rounded-md border transition-colors capitalize disabled:opacity-50",
                      confidence === c
                        ? c === "low" ? "bg-red-500/20 text-destructive border-red-500/40"
                        : c === "medium" ? "bg-growth-amber/20 text-growth-amber border-growth-amber"
                        : "bg-growth-sage/20 text-growth-sage border-growth-sage"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
