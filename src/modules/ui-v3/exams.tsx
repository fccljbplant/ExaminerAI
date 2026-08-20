"use client";

// src/modules/ui-v3/exams.tsx — V3 Learner Exams hub.
// Reimplements the v2 LearnerExams (learner-portal/exams.tsx, 92 lines)
// with v3 design tokens. Same flow — hub linking to practice / daily
// test / weekly test. The actual test-taking UI lives in the routes
// themselves (use TestChatUI from @/modules/assessment).

import Link from "next/link";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";

export function V3LearnerExams() {
  return (
    <>
      <V3PageHeader
        title="Exams"
        subtitle="The Socratic concept-based testing system — practice, daily tests, and weekly tests."
      />

      {/* Explainer card */}
      <V3Card className="v3-class-session" style={{ marginBottom: "var(--p-space-5)" }}>
        <V3Badge>HOW TESTING WORKS</V3Badge>
        <h2 style={{ marginTop: 16, color: "var(--bg)" }}>Daily tests launch in the classroom</h2>
        <p>
          After you finish a topic&apos;s teaching slides, the{" "}
          <strong style={{ color: "var(--bg)" }}>daily Socratic test</strong> opens right there in
          the classroom — you answer, the examiner probes, and your results unlock the next
          topic. Weekly tests gate each week; practice is always open.
        </p>
      </V3Card>

      {/* Three exam modes */}
      <div className="v3-grid v3-grid-3">
        <Link
          href="/learner/practice"
          className="v3-card"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}
        >
          <div className="v3-today-icon" aria-hidden style={{ background: "var(--brand-subtle)", color: "var(--brand)" }}>🧠</div>
          <h3 style={{ margin: "var(--p-space-2) 0 0", color: "var(--text)" }}>Socratic practice</h3>
          <p>
            Chat with the AI examiner on any topic — same format as the tests, just shorter.
          </p>
          <span style={{ marginTop: "var(--p-space-3)", color: "var(--brand)", fontSize: "var(--p-type-sm)", fontWeight: 600 }}>
            ▶ Start
          </span>
        </Link>

        <Link
          href="/learner/exams/daily"
          className="v3-card"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}
        >
          <div className="v3-today-icon" aria-hidden style={{ background: "var(--warning-subtle)", color: "var(--warning-on)" }}>📅</div>
          <h3 style={{ margin: "var(--p-space-2) 0 0", color: "var(--text)" }}>Socratic daily test</h3>
          <p>
            Three concept questions for today — also launches in the classroom after each
            topic&apos;s slides.
          </p>
          <span style={{ marginTop: "var(--p-space-3)", color: "var(--brand)", fontSize: "var(--p-type-sm)", fontWeight: 600 }}>
            ▶ Open
          </span>
        </Link>

        <Link
          href="/learner/exams/weekly"
          className="v3-card"
          style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}
        >
          <div className="v3-today-icon" aria-hidden style={{ background: "var(--info-subtle)", color: "var(--info-on)" }}>📋</div>
          <h3 style={{ margin: "var(--p-space-2) 0 0", color: "var(--text)" }}>Socratic weekly test</h3>
          <p>
            The classic 10-question conversation — graded on concept understanding and
            reasoning.
          </p>
          <span style={{ marginTop: "var(--p-space-3)", color: "var(--brand)", fontSize: "var(--p-type-sm)", fontWeight: 600 }}>
            ▶ Open
          </span>
        </Link>
      </div>
    </>
  );
}
