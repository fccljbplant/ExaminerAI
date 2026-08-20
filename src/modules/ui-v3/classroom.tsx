"use client";
// src/modules/ui-v3/classroom.tsx — V3 classroom (3-column layout).
// Left: course nav, Center: lesson + quiz, Right: AI tutor panel.
//
// P0 note: the layout uses the `.v3-classroom-grid` class (defined in
// v3-shell CSS) instead of an inline `style={{gridTemplateColumns:...}}`.
// The inline form overrode the responsive media query and broke mobile
// (3-column 265+content+320 forced into 375px → horizontal scroll).
// P0 also migrates hardcoded hex colors to v2 semantic tokens.
//
// P1 note: this component is still 100% hardcoded mock content (no
// API call, no real AI tutor — canned 450ms reply). Wiring real APIs
// is P1 item #10 and is intentionally out of scope for this run.
import { V3Badge, V3Progress } from "./v3-shell";
import { useState } from "react";

interface Message {
  role: "tutor" | "user";
  text: string;
}

export function V3Classroom() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "tutor", text: "👋 Hi! I'm following this lesson with you. Ask me to explain something, give you an example, or test your understanding." },
    { role: "user", text: "What does the exponent 2 mean?" },
    { role: "tutor", text: "Great question. The exponent 2 means the variable is multiplied by itself: x² = x × x." },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    // TODO(P1): wire to /api/v2/tutor/ask instead of canned reply.
    setTimeout(() => {
      setMessages(m => [...m, { role: "tutor", text: "✦ Based on the current lesson, I can explain it step by step, give you an example, or create a quick practice question." }]);
    }, 450);
  };

  return (
    <div className="v3-classroom-grid">
      {/* Left: Course Navigation */}
      <aside aria-label="Course lessons">
        <div style={{ padding: "4px 10px 22px" }}>
          <small style={{ color: "var(--text-muted)", fontSize: "var(--p-type-xs)" }}>MATHEMATICS</small>
          <h2 style={{ fontSize: "var(--p-type-lg)", marginTop: 6, color: "var(--text)" }}>Algebra Fundamentals</h2>
        </div>
        <div className="v3-nav-label" style={{ padding: "14px 10px 7px" }}>MODULE 1 · INTRODUCTION</div>
        <div className="v3-classroom-lesson" style={{ color: "var(--success-on)" }}>
          <span className="v3-lesson-status done" aria-hidden>✓</span>
          Welcome to Algebra
        </div>
        <div className="v3-classroom-lesson" style={{ color: "var(--success-on)" }}>
          <span className="v3-lesson-status done" aria-hidden>✓</span>
          Variables &amp; Expressions
        </div>
        <div className="v3-nav-label" style={{ padding: "14px 10px 7px" }}>MODULE 2 · EQUATIONS</div>
        <div className="v3-classroom-lesson active">
          <span className="v3-lesson-status current" aria-hidden>3</span>
          Quadratic Equations
        </div>
        <div className="v3-classroom-lesson">
          <span className="v3-lesson-status" aria-hidden>4</span>
          Solving by Factoring
        </div>
        <div className="v3-classroom-progress-box">
          <strong>
            <span>Course progress</span><span>72%</span>
          </strong>
          <V3Progress value={72} />
        </div>
      </aside>

      {/* Center: Learning Area */}
      <main>
        <div className="v3-class-topbar">
          <span className="v3-breadcrumb">
            ← Back to course / <strong>Lesson 3</strong>
          </span>
          <span className="v3-live-indicator">
            <span className="v3-live-dot" aria-hidden /> LEARNING SESSION
          </span>
        </div>

        <div className="v3-learning-area">
          {/* Video stage — TODO(P1): wire to real video URL */}
          <div className="v3-video-stage">
            <div className="v3-video-content">
              <button
                type="button"
                className="v3-play-button"
                aria-label="Play lesson video"
              >▶</button>
              <h2>Understanding Quadratic Equations</h2>
              <p>Learn how to identify and solve quadratic equations.</p>
            </div>
            <div className="v3-video-meta">
              <span style={{ fontSize: "var(--p-type-sm)" }}>12:34</span>
              <div className="v3-progress" style={{ flex: 1, background: "color-mix(in oklch, var(--bg) 20%, transparent)" }}>
                <span style={{ width: "52%", background: "var(--bg)" }} />
              </div>
              <span style={{ fontSize: "var(--p-type-sm)" }}>24:10</span>
            </div>
          </div>

          {/* Lesson content */}
          <article className="v3-lesson-content">
            <V3Badge>CURRENT LESSON</V3Badge>
            <h1>What is a quadratic equation?</h1>
            <p>
              A quadratic equation is a polynomial equation of degree two. In this lesson, you will learn how to recognize its structure, understand its components, and begin solving simple examples.
            </p>

            {/* Quick actions — TODO(P1): wire to AI tutor prompt */}
            <div className="v3-quick-actions">
              <button type="button" className="v3-btn v3-quick-action">✦ Explain simpler</button>
              <button type="button" className="v3-btn v3-quick-action">◉ Give an example</button>
              <button type="button" className="v3-btn v3-quick-action">✓ Test my understanding</button>
              <button type="button" className="v3-btn v3-quick-action">💡 Give a hint</button>
            </div>

            {/* Interactive quiz — TODO(P1): no pre-styled "correct" answer */}
            <div className="v3-interactive-card">
              <V3Badge variant="warning">QUICK CHECK</V3Badge>
              <h3>Which of these is a quadratic equation?</h3>
              <p>Choose the equation with a highest exponent of 2.</p>
              <div className="v3-answers">
                <button type="button" className="v3-btn v3-answer">A. 2x + 4 = 0</button>
                <button type="button" className="v3-btn v3-answer">B. x² + 3x + 2 = 0</button>
                <button type="button" className="v3-btn v3-answer">C. x³ + 2 = 0</button>
                <button type="button" className="v3-btn v3-answer">D. 5 = 0</button>
              </div>
            </div>
          </article>
        </div>

        {/* Bottom bar */}
        <div className="v3-class-bottom">
          <button type="button" className="v3-btn">← Previous</button>
          <div className="v3-bottom-tools">
            <button type="button" className="v3-btn">📝 Notes</button>
            <button type="button" className="v3-btn">📚 Resources</button>
          </div>
          <button type="button" className="v3-btn v3-btn-success">Complete &amp; Continue →</button>
        </div>
      </main>

      {/* Right: AI Panel */}
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
            <strong>Current context</strong><br />Algebra Fundamentals<br />Lesson 3 · Quadratic Equations
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
        </div>

        <div className="v3-suggestions">
          <button type="button" className="v3-suggestion" onClick={() => setInput("Explain this lesson like I am a beginner.")}>Explain simply</button>
          <button type="button" className="v3-suggestion" onClick={() => setInput("Show me a practical example.")}>Example</button>
          <button type="button" className="v3-suggestion" onClick={() => setInput("Ask me one challenge question.")}>Challenge me</button>
        </div>

        <div className="v3-ai-input">
          <div className="v3-input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
              placeholder="Ask about this lesson..."
              aria-label="Ask the AI tutor"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              className="v3-send"
              aria-label="Send message"
            >↑</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
