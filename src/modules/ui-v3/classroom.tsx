"use client";
// src/modules/ui-v3/classroom.tsx — V3 classroom (3-column layout).
// Left: course nav (real syllabus from API), Center: lesson + quiz,
// Right: AI tutor panel (real streaming /api/v2/tutor/ask).
//
// P1 item 10: replaced 100% hardcoded mock with real APIs.
//   - Syllabus tree: GET /api/v2/courses/[courseId]/syllabus
//   - Active lesson: derived from `current` field in syllabus response
//   - Course progress: computed from completed days / total days
//   - AI tutor chat: POST /api/v2/tutor/ask (streaming, text/event-stream)
//
// What's still mock (deferred to P2 polish):
//   - Video stage: shows lesson title + objective, no real video URL yet
//   - Quick-action chips: pre-fill the tutor input (no separate flow)
//   - Quiz: lesson `deliverable` is rendered as text, not an interactive
//     quiz — that needs a dedicated quiz engine that doesn't exist yet.

import { V3Badge, V3Progress } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateEmpty, StateSkeleton, StateSkeletonHero } from "./states";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ---------- types (mirror /api/v2/courses/[id]/syllabus) ---------- */

type DayStatus = "completed" | "current" | "upcoming";

interface SyllabusDay {
  id: string;
  day: number;
  title: string;
  objective?: string | null;
  activity?: string | null;
  deliverable?: string | null;
  status: DayStatus;
}

interface SyllabusWeek {
  week: number;
  phase?: string | null;
  milestone?: string | null;
  days: SyllabusDay[];
}

interface SyllabusData {
  course: { id: string; name: string };
  current: { week: number; day: number } | null;
  weeks: SyllabusWeek[];
}

/* ---------- types (mirror /api/v2/learner/home.continue) ---------- */

interface ContinueInfo {
  courseId?: string;
  courseName?: string;
  nextLesson?: string;
  kind?: "learn" | "review" | "done";
  href?: string;
}

interface LearnerHome {
  continue?: ContinueInfo | null;
}

/* ---------- AI chat (POST /api/v2/tutor/ask, text/event-stream) ---------- */

interface ChatMessage {
  role: "tutor" | "user";
  text: string;
}

async function askTutor(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  // The tutor API expects [{role, content}] — adapt our local shape.
  const payload = messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));
  const res = await fetch("/api/v2/tutor/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: payload, surface: "v3-classroom" }),
    credentials: "include",
    signal,
  });
  if (!res.ok) {
    // Surface a useful error — most failures are AI quota / feature flag.
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Tutor request failed (HTTP ${res.status})`);
  }
  // Read the text/event-stream as plain text. The API emits plain-text
  // chunks (per its contract), so concatenating the body gives the full
  // tutor reply. A future P2 pass can do progressive streaming display.
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  let chunks = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks += new TextDecoder().decode(value);
  }
  return chunks.trim();
}

/* ---------- helpers ---------- */

function findCurrentDay(s: SyllabusData | null): SyllabusDay | null {
  if (!s || !s.current) return s?.weeks[0]?.days[0] ?? null;
  for (const w of s.weeks) {
    if (w.week === s.current.week) {
      const d = w.days.find((d) => d.day === s.current!.day);
      if (d) return d;
    }
  }
  return s.weeks[0]?.days[0] ?? null;
}

function computeProgress(s: SyllabusData | null): number {
  if (!s || s.weeks.length === 0) return 0;
  let total = 0;
  let done = 0;
  for (const w of s.weeks) {
    for (const d of w.days) {
      total++;
      if (d.status === "completed") done++;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/* ---------- main component ---------- */

export function V3Classroom() {
  // Step 1: get the user's continue card (knows current course ID).
  const { data: home, error: homeErr, retry: homeRetry } = useApi<LearnerHome>("/api/v2/learner/home");
  const courseId = home?.continue?.courseId ?? null;

  // Step 2: when we have a course ID, fetch the syllabus.
  const syllabusUrl = courseId ? `/api/v2/courses/${courseId}/syllabus` : null;
  const { data: syllabus, error: syllabusErr, loading: syllabusLoading, retry: syllabusRetry } = useApi<SyllabusData>(syllabusUrl ?? "/api/v2/courses/none/syllabus");
  const syllabusData = syllabusUrl ? syllabus : null;

  // Step 3: AI chat state.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, tutorBusy]);

  // Welcome message when course context changes.
  useEffect(() => {
    if (!syllabusData) return;
    const active = findCurrentDay(syllabusData);
    if (active) {
      setMessages([{
        role: "tutor",
        text: `👋 Hi! I'm following "${active.title}" with you. Ask me to explain something, give you an example, or test your understanding.`,
      }]);
    }
  }, [syllabusData?.course.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || tutorBusy) return;
    const next: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setTutorBusy(true);
    setTutorError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await askTutor(next, controller.signal);
      setMessages(m => [...m, { role: "tutor", text: reply || "✦ (no response)" }]);
    } catch (e) {
      if (controller.signal.aborted) return; // user cancelled
      setTutorError(e instanceof Error ? e.message : "Tutor unavailable");
    } finally {
      setTutorBusy(false);
      abortRef.current = null;
    }
  };

  const cancelTutor = () => {
    abortRef.current?.abort();
    setTutorBusy(false);
  };

  // Loading state — waiting for /api/v2/learner/home.
  if (homeErr) {
    return <StateError message={homeErr} onRetry={homeRetry} />;
  }
  if (!home) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={3} />
      </>
    );
  }

  // No current course — show empty state instead of fake classroom.
  if (!courseId) {
    return (
      <StateEmpty
        headline="No active course yet"
        description="Pick a course from the catalog to start your first lesson. Your AI tutor will guide you through every topic."
        cta={
          <Link href="/learner/learn" className="v3-btn v3-btn-primary">
            Browse courses →
          </Link>
        }
      />
    );
  }

  // Loading syllabus.
  if (syllabusLoading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={3} />
      </>
    );
  }
  if (syllabusErr) {
    return <StateError message={syllabusErr} onRetry={syllabusRetry} />;
  }

  const activeDay = findCurrentDay(syllabusData);
  const progress = computeProgress(syllabusData);
  const courseName = syllabusData?.course.name ?? home.continue?.courseName ?? "Your course";

  return (
    <div className="v3-classroom-grid">
      {/* Left: Course Navigation (real syllabus) */}
      <aside aria-label="Course lessons">
        <div style={{ padding: "4px 10px 22px" }}>
          <small style={{ color: "var(--text-muted)", fontSize: "var(--p-type-xs)" }}>COURSE</small>
          <h2 style={{ fontSize: "var(--p-type-lg)", marginTop: 6, color: "var(--text)" }}>{courseName}</h2>
        </div>

        {syllabusData?.weeks.map((w) => (
          <div key={w.week}>
            <div className="v3-nav-label" style={{ padding: "14px 10px 7px" }}>
              MODULE {w.week}{w.phase ? ` · ${w.phase.toUpperCase()}` : ""}
            </div>
            {w.days.map((d) => {
              const isActive = activeDay?.id === d.id;
              return (
                <div
                  key={d.id}
                  className={`v3-classroom-lesson ${isActive ? "active" : ""}`}
                >
                  <span
                    className={`v3-lesson-status ${d.status === "completed" ? "done" : d.status === "current" ? "current" : ""}`}
                    aria-hidden
                  >
                    {d.status === "completed" ? "✓" : d.day}
                  </span>
                  {d.title}
                </div>
              );
            })}
          </div>
        ))}

        <div className="v3-classroom-progress-box">
          <strong>
            <span>Course progress</span><span>{progress}%</span>
          </strong>
          <V3Progress value={progress} />
        </div>
      </aside>

      {/* Center: Learning Area */}
      <main>
        <div className="v3-class-topbar">
          <span className="v3-breadcrumb">
            ← <Link href={`/learner/courses/${courseId}`} style={{ color: "inherit" }}>Back to course</Link>{" / "}
            <strong>
              {activeDay ? `Week ${findWeek(syllabusData, activeDay.id)} · Day ${activeDay.day}` : "—"}
            </strong>
          </span>
          <span className="v3-live-indicator">
            <span className="v3-live-dot" aria-hidden /> LEARNING SESSION
          </span>
        </div>

        <div className="v3-learning-area">
          {/* Video stage — shows lesson title + objective (no real video yet). */}
          <div className="v3-video-stage">
            <div className="v3-video-content">
              <button
                type="button"
                className="v3-play-button"
                aria-label={`Start lesson: ${activeDay?.title ?? ""}`}
              >▶</button>
              <h2>{activeDay?.title ?? "Loading lesson…"}</h2>
              <p>{activeDay?.objective || "Open this lesson to begin."}</p>
            </div>
            <div className="v3-video-meta">
              <span style={{ fontSize: "var(--p-type-sm)" }}>Lesson {activeDay?.day ?? 1}</span>
              <div className="v3-progress" style={{ flex: 1, background: "color-mix(in oklch, var(--bg) 20%, transparent)" }}>
                <span style={{ width: `${progress}%`, background: "var(--bg)" }} />
              </div>
              <span style={{ fontSize: "var(--p-type-sm)" }}>{progress}%</span>
            </div>
          </div>

          {/* Lesson content */}
          <article className="v3-lesson-content">
            <V3Badge>CURRENT LESSON</V3Badge>
            <h1>{activeDay?.title ?? "Loading…"}</h1>
            {activeDay?.objective && (
              <p>{activeDay.objective}</p>
            )}
            {activeDay?.activity && (
              <p><strong>Activity:</strong> {activeDay.activity}</p>
            )}
            {activeDay?.deliverable && (
              <p><strong>Deliverable:</strong> {activeDay.deliverable}</p>
            )}

            {/* Quick actions — pre-fill the tutor input */}
            <div className="v3-quick-actions">
              <button
                type="button"
                className="v3-btn v3-quick-action"
                onClick={() => setInput(`Explain "${activeDay?.title ?? "this lesson"}" like I am a beginner.`)}
              >✦ Explain simpler</button>
              <button
                type="button"
                className="v3-btn v3-quick-action"
                onClick={() => setInput("Show me a practical example.")}
              >◉ Give an example</button>
              <button
                type="button"
                className="v3-btn v3-quick-action"
                onClick={() => setInput("Ask me one challenge question.")}
              >✓ Test my understanding</button>
              <button
                type="button"
                className="v3-btn v3-quick-action"
                onClick={() => setInput("Give me a hint but do not reveal the answer.")}
              >💡 Give a hint</button>
            </div>
          </article>
        </div>

        {/* Bottom bar */}
        <div className="v3-class-bottom">
          <button type="button" className="v3-btn" disabled>← Previous</button>
          <div className="v3-bottom-tools">
            <button type="button" className="v3-btn">📝 Notes</button>
            <button type="button" className="v3-btn">📚 Resources</button>
          </div>
          <button type="button" className="v3-btn v3-btn-success">Complete &amp; Continue →</button>
        </div>
      </main>

      {/* Right: AI Panel (real /api/v2/tutor/ask) */}
      <aside className="v3-ai-panel" aria-label="AI tutor">
        <div className="v3-ai-header">
          <div className="v3-ai-title">
            <div className="v3-ai-logo" aria-hidden>✦</div>
            <div>
              <h3>Examiner AI Tutor</h3>
              <small>● Knows your current lesson</small>
            </div>
          </div>
          <div className="v3-ai-context">
            <strong>Current context</strong><br />
            {courseName}<br />
            {activeDay ? `Week ${findWeek(syllabusData, activeDay.id)} · Day ${activeDay.day} — ${activeDay.title}` : "—"}
          </div>
        </div>

        <div className="v3-ai-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === "user" ? "v3-ai-message v3-user-message" : "v3-ai-message"}
            >
              {msg.text}
            </div>
          ))}
          {tutorBusy && (
            <div className="v3-ai-message" aria-live="polite">
              <span style={{ opacity: 0.7 }}>✦ Thinking…</span>
            </div>
          )}
          {tutorError && (
            <div className="v3-ai-message" style={{ background: "var(--danger-subtle)", color: "var(--danger-on)" }}>
              ⚠️ {tutorError}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="v3-suggestions">
          <button
            type="button"
            className="v3-suggestion"
            onClick={() => setInput("Explain this lesson like I am a beginner.")}
          >Explain simply</button>
          <button
            type="button"
            className="v3-suggestion"
            onClick={() => setInput("Show me a practical example.")}
          >Example</button>
          <button
            type="button"
            className="v3-suggestion"
            onClick={() => setInput("Ask me one challenge question.")}
          >Challenge me</button>
        </div>

        <div className="v3-ai-input">
          <div className="v3-input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask about this lesson…"
              aria-label="Ask the AI tutor"
              disabled={tutorBusy}
            />
            {tutorBusy ? (
              <button
                type="button"
                onClick={cancelTutor}
                className="v3-send"
                aria-label="Cancel tutor request"
                style={{ background: "var(--danger)", color: "var(--on-brand)" }}
              >✕</button>
            ) : (
              <button
                type="button"
                onClick={() => sendMessage(input)}
                className="v3-send"
                aria-label="Send message"
                disabled={!input.trim()}
              >↑</button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---------- helper — find which week a day belongs to ---------- */

function findWeek(s: SyllabusData | null, dayId: string): number {
  if (!s) return 1;
  for (const w of s.weeks) {
    if (w.days.some((d) => d.id === dayId)) return w.week;
  }
  return 1;
}
