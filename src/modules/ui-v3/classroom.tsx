"use client";
// src/modules/ui-v3/classroom.tsx — V3 classroom (3-column layout).
// Left: course nav, Center: lesson + quiz, Right: AI tutor panel.
import { V3Card, V3Badge, V3Progress } from "./v3-shell";
import { useState } from "react";

export function V3Classroom() {
  const [messages, setMessages] = useState([
    { role: "tutor", text: "👋 Hi! I'm following this lesson with you. Ask me to explain something, give you an example, or test your understanding." },
    { role: "user", text: "What does the exponent 2 mean?" },
    { role: "tutor", text: "Great question. The exponent 2 means the variable is multiplied by itself: x² = x × x." },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages(m => [...m, { role: "tutor", text: "✦ Based on the current lesson, I can explain it step by step, give you an example, or create a quick practice question." }]);
    }, 450);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "265px minmax(0,1fr) 320px", height: "calc(100vh - 72px)", background: "#f9fafc" }}>
      {/* Left: Course Navigation */}
      <aside style={{ background: "white", borderRight: "1px solid var(--v3-border)", padding: "22px 14px", overflowY: "auto" }}>
        <div style={{ padding: "4px 10px 22px" }}>
          <small style={{ color: "var(--v3-muted)" }}>MATHEMATICS</small>
          <h2 style={{ fontSize: 16, marginTop: 6 }}>Algebra Fundamentals</h2>
        </div>
        <div className="v3-nav-label" style={{ padding: "14px 10px 7px", color: "var(--v3-muted)", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>MODULE 1 · INTRODUCTION</div>
        <div className="v3-nav-item" style={{ color: "var(--v3-success)" }}>✓ Welcome to Algebra</div>
        <div className="v3-nav-item" style={{ color: "var(--v3-success)" }}>✓ Variables & Expressions</div>
        <div className="v3-nav-label" style={{ padding: "14px 10px 7px", color: "var(--v3-muted)", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>MODULE 2 · EQUATIONS</div>
        <div className="v3-nav-item active" style={{ background: "var(--v3-primary-soft)", color: "var(--v3-primary)", fontWeight: 700, borderRadius: 10, padding: "11px 10px", display: "flex", gap: 10, alignItems: "center", fontSize: 13, marginBottom: 2 }}>
          <span style={{ width: 21, height: 21, borderRadius: "50%", background: "var(--v3-primary)", color: "white", display: "grid", placeItems: "center", fontSize: 10 }}>3</span>
          Quadratic Equations
        </div>
        <div className="v3-nav-item" style={{ color: "#697386", fontSize: 13, padding: "11px 10px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 21, height: 21, borderRadius: "50%", background: "#eef1f5", display: "grid", placeItems: "center", fontSize: 10 }}>4</span>
          Solving by Factoring
        </div>
        <div style={{ margin: "20px 5px", padding: 16, borderRadius: 14, background: "#f7f8fc" }}>
          <strong style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
            <span>Course progress</span><span>72%</span>
          </strong>
          <V3Progress value={72} />
        </div>
      </aside>

      {/* Center: Learning Area */}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ height: 70, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderBottom: "1px solid var(--v3-border)" }}>
          <span style={{ fontSize: 13, color: "var(--v3-muted)" }}>← Back to course / <strong style={{ color: "var(--v3-text)" }}>Lesson 3</strong></span>
          <span style={{ color: "var(--v3-danger)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, background: "var(--v3-danger)", borderRadius: "50%" }} /> LEARNING SESSION
          </span>
        </div>

        <div style={{ padding: 28, overflowY: "auto", flex: 1 }}>
          {/* Video stage */}
          <div style={{ minHeight: 380, borderRadius: 20, overflow: "hidden", background: "radial-gradient(circle at 20% 20%, rgba(123,125,255,.25), transparent 25%), linear-gradient(135deg, #16192d, #2e3265)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ textAlign: "center" }}>
              <button style={{ width: 70, height: 70, borderRadius: "50%", background: "white", color: "var(--v3-primary)", fontSize: 22, margin: "0 auto", display: "grid", placeItems: "center", border: 0, cursor: "pointer" }}>▶</button>
              <h2 style={{ marginTop: 20, fontSize: 22 }}>Understanding Quadratic Equations</h2>
              <p style={{ color: "#b8bdd8", marginTop: 8 }}>Learn how to identify and solve quadratic equations.</p>
            </div>
            <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 12 }}>12:34</span>
              <div className="v3-progress" style={{ flex: 1, background: "rgba(255,255,255,.2)" }}><span style={{ width: "52%", background: "white" }} /></div>
              <span style={{ fontSize: 12 }}>24:10</span>
            </div>
          </div>

          {/* Lesson content */}
          <article style={{ maxWidth: 850, margin: "26px auto" }}>
            <V3Badge>CURRENT LESSON</V3Badge>
            <h1 style={{ fontSize: 25, marginTop: 12 }}>What is a quadratic equation?</h1>
            <p style={{ marginTop: 12, color: "var(--v3-muted)", lineHeight: 1.7 }}>
              A quadratic equation is a polynomial equation of degree two. In this lesson, you will learn how to recognize its structure, understand its components, and begin solving simple examples.
            </p>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              <button className="v3-btn" style={{ fontSize: 12 }}>✦ Explain simpler</button>
              <button className="v3-btn" style={{ fontSize: 12 }}>◉ Give an example</button>
              <button className="v3-btn" style={{ fontSize: 12 }}>✓ Test my understanding</button>
              <button className="v3-btn" style={{ fontSize: 12 }}>💡 Give a hint</button>
            </div>

            {/* Interactive quiz */}
            <div style={{ marginTop: 25, border: "1px solid #dedfff", background: "#fbfbff", borderRadius: 16, padding: 20 }}>
              <V3Badge variant="warning">QUICK CHECK</V3Badge>
              <h3 style={{ fontSize: 15, marginTop: 14 }}>Which of these is a quadratic equation?</h3>
              <p style={{ margin: "8px 0 16px", color: "var(--v3-muted)", fontSize: 13 }}>Choose the equation with a highest exponent of 2.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                <button className="v3-btn" style={{ textAlign: "left", fontSize: 13 }}>A. 2x + 4 = 0</button>
                <button className="v3-btn" style={{ textAlign: "left", fontSize: 13, borderColor: "var(--v3-success)", background: "#e9faf3" }}>B. x² + 3x + 2 = 0</button>
                <button className="v3-btn" style={{ textAlign: "left", fontSize: 13 }}>C. x³ + 2 = 0</button>
                <button className="v3-btn" style={{ textAlign: "left", fontSize: 13 }}>D. 5 = 0</button>
              </div>
            </div>
          </article>
        </div>

        {/* Bottom bar */}
        <div style={{ background: "white", borderTop: "1px solid var(--v3-border)", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="v3-btn">← Previous</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="v3-btn">📝 Notes</button>
            <button className="v3-btn">📚 Resources</button>
          </div>
          <button className="v3-btn v3-btn-success">Complete & Continue →</button>
        </div>
      </main>

      {/* Right: AI Panel */}
      <aside style={{ background: "white", borderLeft: "1px solid var(--v3-border)", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: 22, borderBottom: "1px solid var(--v3-border)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--v3-primary-soft)", display: "grid", placeItems: "center", color: "var(--v3-primary)" }}>✦</div>
            <div>
              <h3 style={{ fontSize: 14 }}>Examiner AI Tutor</h3>
              <small style={{ color: "var(--v3-success)", fontSize: 11 }}>● Knows your current lesson</small>
            </div>
          </div>
          <div style={{ marginTop: 17, padding: 12, background: "#f7f7ff", borderRadius: 10, fontSize: 12, color: "#63649e", lineHeight: 1.5 }}>
            <strong>Current context</strong><br />Algebra Fundamentals<br />Lesson 3 · Quadratic Equations
          </div>
        </div>

        <div style={{ flex: 1, padding: 18, overflowY: "auto" }}>
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "v3-user-message" : ""} style={{
              background: msg.role === "user" ? "var(--v3-primary)" : "#f5f6fa",
              color: msg.role === "user" ? "white" : "#46505d",
              padding: 12,
              borderRadius: msg.role === "user" ? "13px 4px 13px 13px" : "4px 13px 13px 13px",
              fontSize: 13,
              lineHeight: 1.55,
              marginBottom: 14,
              marginLeft: msg.role === "user" ? 35 : 0,
            }}>
              {msg.text}
            </div>
          ))}
        </div>

        <div style={{ padding: "0 18px 14px", display: "flex", gap: 7, flexWrap: "wrap" }}>
          <button className="v3-btn" style={{ fontSize: 11, padding: "8px 10px" }}>Explain simply</button>
          <button className="v3-btn" style={{ fontSize: 11, padding: "8px 10px" }}>Example</button>
          <button className="v3-btn" style={{ fontSize: 11, padding: "8px 10px" }}>Challenge me</button>
        </div>

        <div style={{ borderTop: "1px solid var(--v3-border)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f7f8fb", border: "1px solid var(--v3-border)", padding: 7, borderRadius: 12 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
              placeholder="Ask about this lesson..."
              style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: 8, minWidth: 0, fontSize: 13 }}
            />
            <button onClick={() => sendMessage(input)} style={{ width: 34, height: 34, borderRadius: 9, background: "var(--v3-primary)", color: "white", border: 0, cursor: "pointer" }}>↑</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
