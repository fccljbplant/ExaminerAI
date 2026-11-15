"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  MessagesSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

/**
 * modules/learner-portal — Roleplay practice (2026-08-16)
 *
 * Scenario library -> chat stage with an AI persona. Every student turn
 * is scored (0-100) with concrete feedback; the final score is the
 * rounded average. Completed runs show a score panel with per-turn
 * feedback and a "Try again" restart.
 */

interface Scenario {
  id: string;
  key: string;
  title: string;
  personaName: string;
  goal: string;
  turnBudget: number;
  difficulty: string;
}

export interface RoleplayTurn {
  role: "student" | "persona";
  content: string;
  score?: number | null;
  feedback?: string | null;
}

export interface RoleplayRun {
  id: string;
  scenarioId: string;
  status: string;
  turns: RoleplayTurn[];
  score: number | null;
  completedAt: string | null;
}

/** Scenario library card: title leads, difficulty inline, one primary affordance. */
export function ScenarioCard({
  scenario,
  starting,
  disabled,
  onStart,
}: {
  scenario: Scenario;
  starting: boolean;
  disabled: boolean;
  onStart: (s: Scenario) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onStart(scenario)}
      disabled={disabled}
      className="flex min-h-36 flex-col rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">{scenario.title}</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
          {scenario.difficulty}
        </span>
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        Persona: {scenario.personaName} · {scenario.turnBudget} turns
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{scenario.goal}</p>
      <span className="mt-auto pt-3 text-xs font-semibold text-brand">
        {starting ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Starting…
          </span>
        ) : (
          "Start scenario"
        )}
      </span>
    </button>
  );
}

/** Turn budget pill: calm while budget is healthy, danger tone at ≤2 turns left. */
export function TurnStatus({ completed, remaining }: { completed: boolean; remaining: number }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
        completed
          ? "border-line bg-bg-subtle text-fg-muted"
          : remaining <= 2
            ? "border-danger/40 text-danger"
            : "border-line text-fg-secondary"
      }`}
    >
      {completed ? "Completed" : `${remaining} turn${remaining === 1 ? "" : "s"} left`}
    </span>
  );
}

/** One chat bubble: student replies brand-tinted, persona replies bordered with the score. */
export function TurnBubble({ turn }: { turn: RoleplayTurn }) {
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        turn.role === "student"
          ? "ml-auto rounded-br-sm bg-brand text-on-brand"
          : "rounded-bl-sm border border-line bg-surface text-fg"
      }`}
    >
      <p>{turn.content || "…"}</p>
      {turn.role === "persona" && typeof turn.score === "number" && (
        <p className="mt-1.5 text-[11px] leading-snug text-fg-muted">
          <span className="font-semibold">Score: {turn.score}/100.</span> {turn.feedback}
        </p>
      )}
    </div>
  );
}

/** End-of-run panel: average score up front, per-turn feedback, one restart action. */
export function CompletedPanel({ run, onRestart }: { run: RoleplayRun; onRestart: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-fg">
        Scenario complete — average score:{" "}
        <span className="text-brand">{run.score ?? "—"}</span>
      </p>
      <ul className="mt-2 space-y-2">
        {run.turns
          .filter((t) => t.role === "persona" && typeof t.score === "number" && t.feedback)
          .map((t, i) => (
            <li key={i} className="text-xs leading-relaxed text-fg-secondary">
              <span className="font-semibold text-fg">{t.score}/100</span> — {t.feedback}
            </li>
          ))}
      </ul>
      <button
        type="button"
        onClick={onRestart}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}

export function RoleplayPractice() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<Scenario | null>(null);
  const [run, setRun] = useState<RoleplayRun | null>(null);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadScenarios = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get<{ data: { scenarios: Scenario[] } }>("/api/v2/roleplay/scenarios");
      setScenarios(res.data.scenarios ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load scenarios");
    }
  }, []);

  useEffect(() => {
    void loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.turns.length]);

  async function start(scenario: Scenario) {
    setStarting(scenario.id);
    try {
      const res = await api.post<{ data: { run: RoleplayRun } }>("/api/v2/roleplay/runs", { scenarioId: scenario.id });
      setActive(scenario);
      setRun(res.data.run);
      setInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start roleplay");
    } finally {
      setStarting(null);
    }
  }

  async function send() {
    if (!run || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    // Optimistic student bubble while the AI thinks.
    setRun((prev) =>
      prev ? { ...prev, turns: [...prev.turns, { role: "student", content: text }] } : prev,
    );
    try {
      const res = await api.post<{ data: { run: RoleplayRun; personaTurn: RoleplayTurn } }>(
        `/api/v2/roleplay/runs/${run.id}`,
        { message: text },
        60_000,
      );
      setRun(res.data.run);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        // The student turn was still persisted server-side — resync.
        const fresh = await api
          .get<{ data: { run: RoleplayRun } }>(`/api/v2/roleplay/runs/${run.id}`)
          .catch(() => null);
        if (fresh) setRun(fresh.data.run);
        toast.error(e.message || "AI unavailable — try again");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to send");
      }
    } finally {
      setSending(false);
    }
  }

  // ── List stage ────────────────────────────────────────────────────────

  if (!active) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          <h1 className="text-lg font-semibold text-fg md:text-xl">Roleplay practice</h1>
        </div>
        <p className="text-xs text-fg-muted">
          Practice real workplace conversations with an AI persona. Every reply is scored, with
          concrete feedback to improve your next attempt.
        </p>

        {!scenarios && !loadError && (
          <div className="animate-pulse space-y-3" aria-busy="true">
            <div className="h-24 rounded-xl bg-bg-subtle" />
            <div className="h-24 rounded-xl bg-bg-subtle" />
            <div className="h-24 rounded-xl bg-bg-subtle" />
          </div>
        )}

        {loadError && (
          <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load scenarios</p>
            <p className="mt-1 text-xs text-fg-muted">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadScenarios()}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          </div>
        )}

        {scenarios && scenarios.length === 0 && (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <MessagesSquare className="mx-auto h-6 w-6 text-fg-muted" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-fg">No scenarios available yet</p>
            <p className="mt-1 text-xs text-fg-muted">Check back soon for new practice scenarios.</p>
          </div>
        )}

        {scenarios && scenarios.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                starting={starting === s.id}
                disabled={starting !== null}
                onStart={(sc) => void start(sc)}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  // ── Chat stage ────────────────────────────────────────────────────────

  const studentCount = run ? run.turns.filter((t) => t.role === "student").length : 0;
  const remaining = active.turnBudget - studentCount;
  const completed = run?.status === "completed";

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActive(null);
            setRun(null);
          }}
          aria-label="Back to scenarios"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-fg md:text-xl">{active.title}</h1>
          <p className="truncate text-xs text-fg-muted">
            {active.personaName} · {active.difficulty}
          </p>
        </div>
        <TurnStatus completed={completed} remaining={remaining} />
      </div>

      <p className="rounded-xl border border-line bg-bg-subtle px-3 py-2 text-xs text-fg-muted">
        <Target className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Goal: {active.goal}
      </p>

      <div className="space-y-3" role="log" aria-label="Conversation transcript">
        {run?.turns.map((turn, i) => (
          <TurnBubble key={`${i}-${turn.role}`} turn={turn} />
        ))}
        {sending && (
          <div
            role="status"
            aria-label="Persona is replying"
            className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-fg-muted"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {completed && run && <CompletedPanel run={run} onRestart={() => void start(active)} />}

      {!completed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Say something…"
            aria-label="Your reply"
            className="min-h-20 flex-1 resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || remaining <= 0}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Send
          </button>
        </form>
      )}
    </section>
  );
}
