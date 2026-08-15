/**
 * modules/assessment/lib — test-ledger.ts (2026-08-15)
 *
 * The COMPACT PER-QUESTION LEDGER — the only history shape the AI ever
 * sees during a Socratic test. Fixes the long-session timeout problem:
 * instead of shipping the whole chat (which grows every turn), each AI
 * call receives:
 *
 *   • the fixed system prompt
 *   • a compact ledger: one line per completed question (question,
 *     answer summary, per-question score, teaching note)
 *   • the CURRENT question + the student's latest answer
 *
 * Every piece comes from data already saved locally (the conversation
 * row, incl. per-question AI explanations), so the payload stays small
 * and constant-size no matter how long the session runs.
 */

export interface LedgerMessage {
  role: "student" | "examiner";
  content: string;
  questionIndex?: number;
  questionExplanation?: {
    question?: string;
    studentAnswer?: string;
    correctAnswer?: string;
    explanation?: string;
    encouragement?: string;
    score?: number;
  } | null;
}

export interface LedgerEntry {
  /** 0-based question index */
  index: number;
  question: string;
  answerSummary: string;
  replyCount: number;
  score: number | null;
  teachingNote: string | null;
}

/** Build the compact ledger from a conversation. Pure — no DB, no AI. */
export function buildTestLedger(conversation: LedgerMessage[]): LedgerEntry[] {
  const byIndex = new Map<number, LedgerMessage[]>();
  for (const m of conversation) {
    const idx = typeof m.questionIndex === "number" ? m.questionIndex : -1;
    if (idx < 0) continue;
    const bucket = byIndex.get(idx) ?? [];
    bucket.push(m);
    byIndex.set(idx, bucket);
  }

  const entries: LedgerEntry[] = [];
  for (const [index, messages] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
    const examinerMsgs = messages.filter((m) => m.role === "examiner");
    const studentMsgs = messages.filter((m) => m.role === "student");

    // The question: from the per-question explanation if present,
    // otherwise the first examiner message of this index.
    const explanation = [...messages]
      .reverse()
      .map((m) => m.questionExplanation)
      .find((e) => e?.question || e?.correctAnswer);

    const question = truncate(
      explanation?.question ||
        examinerMsgs.find((m) => m.content.trim().length > 0)?.content ||
        examinerMsgs[0]?.content ||
        "(question unavailable)",
      240,
    );

    entries.push({
      index,
      question,
      answerSummary: truncate(
        studentMsgs.map((m) => m.content).join(" · "),
        320,
      ),
      replyCount: studentMsgs.length,
      score: typeof explanation?.score === "number" ? explanation.score : null,
      teachingNote: explanation?.correctAnswer
        ? truncate(explanation.correctAnswer, 220)
        : null,
    });
  }
  return entries;
}

/** Render the ledger as a compact prompt block. */
export function ledgerToPrompt(ledger: LedgerEntry[]): string {
  if (ledger.length === 0) return "(no completed questions yet)";
  return ledger
    .map((e) => {
      const scorePart = e.score != null ? `${e.score}%` : "ungraded";
      const answerPart = e.answerSummary || "(no answer)";
      const notePart = e.teachingNote ? `\n  Teaching note: ${e.teachingNote}` : "";
      return `Q${e.index + 1} [${scorePart}, ${e.replyCount} repl${e.replyCount === 1 ? "y" : "ies"}]: "${e.question}"\n  Student: "${answerPart}"${notePart}`;
    })
    .join("\n");
}

/** Build the prompt that asks the AI to produce ONLY the next question. */
export function buildNextQuestionPrompt(args: {
  systemPrompt: string;
  ledgerText: string;
  questionNumber: number;
  totalQuestions: number;
  topic: string;
  weekLabel?: string;
}): { role: "system" | "user"; content: string }[] {
  const { systemPrompt, ledgerText, questionNumber, totalQuestions, topic, weekLabel } = args;
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `TEST LEDGER (what has happened so far, compact):
${ledgerText}

Ask Question ${questionNumber} of ${totalQuestions}${weekLabel ? ` for ${weekLabel}` : ""} about "${topic}".

RULES:
- Ask ONE question only. No feedback, no recap, no explanation of the previous answer.
- Do NOT prefix with "Question N:" — just ask directly.
- Match the student's language (Roman Urdu → Roman Urdu, English → English). NEVER native scripts.
- Keep it under 2 sentences. You are testing, not teaching.`,
    },
  ];
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
