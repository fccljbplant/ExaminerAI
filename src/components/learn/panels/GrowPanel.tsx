"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Trophy, Flame, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { tutor } from "@/components/learn/TutorAvatar";

interface Question {
  question: string;
  format: "open" | "short" | "probe";
  conceptId: string;
  isSpacedRepetition: boolean;
}

interface Answer {
  answer: string;
  evaluation: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
}

interface Props {
  courseId: string;
  xpTotal: number;
  learnerLevel: string;
  streak: number;
  onXPChange?: () => void;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GrowPanel({ courseId, xpTotal, learnerLevel, streak, onXPChange }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const startTest = useCallback(async () => {
    setStarting(true);
    try {
      const res = await api.post<{ data: { testId: string; questions: Question[]; status: string } }>(
        `/api/learn/daily-test/${todayKey()}/start`,
        { courseId },
        AI_TIMEOUT_MS,
      );
      setTestId(res.data.testId);
      setQuestions(res.data.questions);
      setAnswers([]);
      setQIdx(0);
      setInput("");
      setFinalScore(null);
    } catch (e) {
      toast.error("Couldn't start the daily test", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setStarting(false);
    }
  }, [courseId]);

  async function submitAnswer() {
    if (!testId || !questions) return;
    if (!input.trim()) {
      toast.error("Type an answer first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: { evaluation: string; feedback: string; score: number; isComplete: boolean; finalScore: number | null } }>(
        `/api/learn/daily-test/${todayKey()}/answer`,
        { testId, questionIdx: qIdx, answer: input.trim() },
        AI_TIMEOUT_MS,
      );
      const newAnswer: Answer = {
        answer: input.trim(),
        evaluation: res.data.evaluation as Answer["evaluation"],
        score: res.data.score,
        feedback: res.data.feedback,
      };
      const nextAnswers = [...answers, newAnswer];
      setAnswers(nextAnswers);
      setInput("");

      if (res.data.evaluation === "correct") tutor.play("thumbsup");
      else if (res.data.evaluation === "incorrect") tutor.play("comfort");
      else tutor.play("point");

      if (res.data.isComplete) {
        setFinalScore(res.data.finalScore);
        toast.success("Daily test complete!", { description: "+30 XP" });
        onXPChange?.();
      } else {
        setQIdx(qIdx + 1);
      }
    } catch (e) {
      toast.error("Couldn't submit answer", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-4 border-b">
        <h2 className="text-lg font-semibold">Grow</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Daily tests, XP, streaks, and badges.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stats */}
        <section className="grid grid-cols-3 gap-2">
          <StatCard icon={<Star className="h-4 w-4 text-amber-500" />} label="XP" value={xpTotal} />
          <StatCard icon={<Trophy className="h-4 w-4 text-primary" />} label="Level" value={learnerLevel} />
          <StatCard icon={<Flame className="h-4 w-4 text-orange-500" />} label="Streak" value={`${streak}d`} />
        </section>

        {/* Daily test */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Today's test</h3>
          {!questions && (
            <div className="rounded-lg border p-4">
              <p className="text-sm">
                Take today's 3-question test to lock in what you learned. Two questions on today's topic, one from a past topic for spaced repetition.
              </p>
              <button
                onClick={startTest}
                disabled={starting}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start today's test
              </button>
            </div>
          )}

          {questions && finalScore === null && (
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Question {qIdx + 1} of {questions.length}
                  {questions[qIdx]?.isSpacedRepetition && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600">Spaced repetition</span>
                  )}
                </span>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <span key={i} className={cn(
                      "h-1.5 w-6 rounded-full",
                      i < answers.length ? "bg-primary" : i === qIdx ? "bg-primary/50" : "bg-muted",
                    )} />
                  ))}
                </div>
              </div>
              <p className="font-medium leading-snug">{questions[qIdx]?.question}</p>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="Type your answer..."
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                maxLength={2000}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer(); }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">⌘+Enter to submit</span>
                <button
                  onClick={submitAnswer}
                  disabled={submitting || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Submit answer
                </button>
              </div>
            </div>
          )}

          {finalScore !== null && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto text-primary" />
              <p className="mt-2 text-lg font-semibold">Test complete</p>
              <p className="text-sm text-muted-foreground">
                You scored {finalScore.toFixed(2)} / {questions?.length ?? 3}
              </p>
              <button
                onClick={startTest}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                Try again tomorrow (or review today's topic first)
              </button>
            </div>
          )}
        </section>

        {/* Per-question feedback (after submit) */}
        {answers.length > 0 && finalScore === null && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Previous answers</h3>
            <ul className="space-y-2">
              {answers.map((a, i) => (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    {a.evaluation === "correct" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {a.evaluation === "partial" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                    {a.evaluation === "incorrect" && <XCircle className="h-4 w-4 text-rose-500" />}
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{a.evaluation}</span>
                    <span className="text-xs text-muted-foreground">· score {a.score.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">You: {a.answer}</p>
                  <p className="text-xs mt-1">💡 {a.feedback}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
