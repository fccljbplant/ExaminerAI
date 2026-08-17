"use client";

/**
 * WeeklyTestPanel — course-scoped Socratic weekly test (2026-08-18).
 *
 * Drives the /api/learn/weekly-test/[week] routes: 10 questions over
 * THIS course's week material, per-question AI evaluation, score + XP
 * attributed to the course. Used in the classroom on the last day of a
 * course week and on the standalone weekly page. Replaces the legacy
 * stats-based panel (course-blind, legacy WeeklyTest rows).
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Loader2, CheckCircle2, CalendarCheck } from "lucide-react";
import { PostTestReflection } from "@/modules/assessment/components/PostTestReflection";
import { TestChatUI } from "@/modules/assessment/components/TestChatUI";

interface ChatMessage {
  role: "student" | "examiner";
  content: string;
  timestamp: string;
  questionIndex: number;
}

interface Question {
  question: string;
  format: string;
  conceptId: string;
}

interface StoredAnswer {
  answer: string;
  evaluation: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
}

interface StartData {
  testId: string;
  week: number;
  questions: Question[];
  status: "in_progress" | "completed";
  answers: (StoredAnswer | null)[];
}

interface AnswerData {
  evaluation: string;
  feedback: string;
  score: number;
  isComplete: boolean;
  finalScore: number | null;
}

/** 0..N final score → 0..100 percent. */
function toPercent(finalScore: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((finalScore / questionCount) * 100)));
}

export function WeeklyTestPanel({
  courseId,
  week,
  weekLabel,
  onComplete,
}: {
  courseId: string;
  week: number;
  /** e.g. "Week 3 — Planning & Dev Environment". */
  weekLabel?: string;
  onComplete?: (score: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [testId, setTestId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef(false);

  const buildTranscript = useCallback((qs: Question[], answers: (StoredAnswer | null)[], upto: number) => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < upto && i < qs.length; i++) {
      const a = answers[i];
      if (a) {
        msgs.push({ role: "student", content: a.answer, timestamp: new Date().toISOString(), questionIndex: i });
        msgs.push({ role: "examiner", content: a.feedback, timestamp: new Date().toISOString(), questionIndex: i });
      }
    }
    if (upto < qs.length) {
      msgs.push({ role: "examiner", content: qs[upto].question, timestamp: new Date().toISOString(), questionIndex: upto });
    }
    return msgs;
  }, []);

  // Auto-start (or resume) the weekly test — idempotent per (user, course, week).
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ data: StartData }>(
        `/api/learn/weekly-test/${week}/start`,
        { courseId },
        AI_TIMEOUT_MS,
      );
      const data = res.data;
      setTestId(data.testId);
      setQuestions(data.questions);
      if (data.status === "completed") {
        const pct = toPercent(
          (data.answers ?? []).reduce<number>((acc, a) => acc + (a ? a.score : 0), 0),
          data.questions.length,
        );
        setIsComplete(true);
        setScore(pct);
        setConversation(buildTranscript(data.questions, data.answers ?? [], data.questions.length));
        if (!reportedRef.current && onComplete) {
          reportedRef.current = true;
          onComplete(pct);
        }
      } else {
        const answered = (data.answers ?? []).filter(Boolean).length;
        setIsComplete(false);
        setScore(null);
        setCurrentQuestion(answered);
        setConversation(buildTranscript(data.questions, data.answers ?? [], answered));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load this week's test");
    } finally {
      setLoading(false);
    }
  }, [courseId, week, buildTranscript, onComplete]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, busy]);

  const sendReply = async () => {
    if (!testId || !input.trim() || busy) return;
    const msg = input.trim();
    const qIdx = currentQuestion;
    setInput("");
    setError("");
    setBusy(true);

    const studentMsg: ChatMessage = {
      role: "student",
      content: msg,
      timestamp: new Date().toISOString(),
      questionIndex: qIdx,
    };
    setConversation((prev) => [...prev, studentMsg]);

    try {
      const res = await api.post<{ data: AnswerData }>(
        `/api/learn/weekly-test/${week}/answer`,
        { testId, questionIdx: qIdx, answer: msg },
        AI_TIMEOUT_MS,
      );
      const data = res.data;

      const nextMsgs: ChatMessage[] = [
        { role: "examiner", content: data.feedback, timestamp: new Date().toISOString(), questionIndex: qIdx },
      ];
      if (!data.isComplete && qIdx + 1 < questions.length) {
        nextMsgs.push({
          role: "examiner",
          content: questions[qIdx + 1].question,
          timestamp: new Date().toISOString(),
          questionIndex: qIdx + 1,
        });
      }
      setConversation((prev) => [...prev, ...nextMsgs]);

      if (data.isComplete) {
        const pct = toPercent(data.finalScore ?? 0, questions.length);
        setIsComplete(true);
        setScore(pct);
        setLastFeedback(data.feedback);
        setCurrentQuestion(questions.length);
        if (!reportedRef.current && onComplete) {
          reportedRef.current = true;
          onComplete(pct);
        }
      } else {
        setCurrentQuestion(qIdx + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reply");
      setConversation((prev) => prev.filter((m) => m !== studentMsg));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-line bg-surface">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand/30 bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-fg">
          <CalendarCheck className="h-4 w-4 text-brand" /> Weekly Test
        </CardTitle>
        <CardDescription className="text-fg-muted">
          {weekLabel
            ? `${weekLabel} — 10 questions covering this week's material.`
            : `Week ${week} — 10 questions covering this week's material.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}

        {isComplete && score !== null && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-success" />
            <p className="text-sm font-medium text-fg">Weekly test complete!</p>
            <p className="mt-1 text-3xl font-bold text-fg">{score}%</p>
            {lastFeedback && (
              <p className="mx-auto mt-3 max-w-md rounded-lg bg-bg-subtle px-4 py-3 text-left text-xs leading-relaxed text-fg-secondary">
                <span className="font-semibold text-fg">Examiner&apos;s note: </span>
                {lastFeedback}
              </p>
            )}
            <Button
              onClick={() => {
                setIsComplete(false);
                setConversation([]);
                setTestId(null);
                setScore(null);
                setLastFeedback(null);
              }}
              variant="outline"
              size="sm"
              className="mt-3 border-line"
            >
              Done
            </Button>
            <PostTestReflection score={score} testType="weekly_test" />
          </div>
        )}

        {conversation.length > 0 && !isComplete && (
          <TestChatUI
            conversation={conversation}
            input={input}
            onInputChange={setInput}
            onSend={() => void sendReply()}
            busy={busy}
            currentQuestion={currentQuestion}
            questionCountLabel={`Question ${Math.min(currentQuestion + 1, questions.length)} of ${questions.length}`}
            topicBadge={weekLabel ?? `Week ${week}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
