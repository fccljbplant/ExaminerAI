import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI, translateBehavioralSignals, TOKEN_BUDGET } from "@/lib/ai-provider";
import { evaluatePrompt } from "@/lib/ai-prompts";

/** POST /api/ai/evaluate — evaluate a student's answer to a Socratic question.
 *  Returns correctness 0-100, feedback, level, gaps, followUp, and persists the interaction. */
export async function POST(req: NextRequest) {
  const { isFeatureEnabled } = await import("@/lib/feature-flags");
  if (!(await isFeatureEnabled("ai_enabled"))) return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can submit evaluations" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    week, topic, pillar, question, projectContext, answer,
    timeTakenSeconds, wordCount, projectType,
  } = body as Record<string, unknown>;

  const w = Number(week ?? user.currentWeek);
  const ans = String(answer ?? "").trim();
  if (!ans) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  // Skip AI call for low-effort answers — save tokens, return fast heuristic.
  // Be lenient: beginners often give short answers — still give partial credit (floor 50).
  if (ans.split(/\s+/).length < 3 || ans.toLowerCase() === String(question ?? "").toLowerCase().slice(0, 50)) {
    const evaluation = {
      correctness: 50,
      feedback: "That answer is too short to evaluate properly. Try writing at least a full sentence explaining what you understand — even a few words about the concept will get a much better score.",
      level: "Beginner",
      gaps: ["Needs more detail"],
      followUp: null,
      cognitiveLoad: "low",
      confidence: "low",
      metacognitive: "low",
      plagiarismScore: 0,
      plagiarismNotes: "No signs of plagiarism detected.",
    };
    const behavioralInsights = translateBehavioralSignals("low", "low", "low", 50);
    return NextResponse.json({ evaluation, behavioralInsights, skipped: true });
  }

  // Prompt imported from src/lib/ai-prompts.ts — single source of truth
  const prompt = evaluatePrompt(
    String(question ?? ""),
    ans,
    Number(wordCount ?? 0),
    Number(timeTakenSeconds ?? 0),
    String(topic ?? "")
  );

  let evaluation: {
    correctness: number;
    feedback: string;
    level: string;
    gaps: string[];
    followUp: string | null;
    cognitiveLoad: string;
    confidence: string;
    metacognitive: string;
    plagiarismScore: number;
    plagiarismNotes: string;
  };

  try {
    const result = await callAI([
      { role: "user", content: prompt },
    ], { temperature: 0.3, maxTokens: TOKEN_BUDGET.EVALUATION, feature: "evaluate" });
    const raw = result.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    evaluation = {
      // HARD FLOOR: enforce 50% minimum for beginner bootcamp.
      correctness: Math.max(50, Math.min(100, Number(parsed.correctness ?? 60))),
      feedback: String(parsed.feedback ?? "No feedback."),
      level: String(parsed.level ?? "Beginner"),
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      followUp: parsed.followUp ? String(parsed.followUp) : null,
      cognitiveLoad: String(parsed.cognitiveLoad ?? "moderate"),
      confidence: String(parsed.confidence ?? "moderate"),
      metacognitive: String(parsed.metacognitive ?? "moderate"),
      plagiarismScore: Math.max(0, Math.min(100, Number(parsed.plagiarismScore ?? 0))),
      plagiarismNotes: String(parsed.plagiarismNotes ?? "No signs of plagiarism detected."),
    };
    // ---- Server-side heuristic plagiarism boost ----
    // The AI might miss some patterns. Add programmatic checks on top.
    const aiPlagiarism = evaluation.plagiarismScore;
    let heuristicBoost = 0;
    const heuristicReasons: string[] = [];

    // Check 1: Response time too fast (< 3 seconds for a real answer)
    if (Number(timeTakenSeconds ?? 0) > 0 && Number(timeTakenSeconds ?? 0) < 3 && ans.split(/\s+/).length > 20) {
      heuristicBoost += 25;
      heuristicReasons.push("answered too fast for the length");
    }

    // Check 2: AI-typical phrases
    const aiPhrases = [
      "it's important to note", "in essence", "furthermore", "additionally",
      "it's worth mentioning", "this means that", "in conclusion",
      "it's crucial to understand", "as a best practice", "in the context of",
      "from a technical perspective", "it's essential to", "to put it simply",
      "needless to say", "generally speaking", "in today's world",
    ];
    const lowerAns = ans.toLowerCase();
    for (const phrase of aiPhrases) {
      if (lowerAns.includes(phrase)) {
        heuristicBoost += 10;
        heuristicReasons.push("uses AI-typical phrasing");
        break; // only count once
      }
    }

    // Check 3: Perfect grammar (no contractions, no casual language)
    // Beginners typically use contractions (don't, can't, it's) and casual words
    const hasContractions = /\b(don't|can't|won't|isn't|aren't|it's|that's|there's|they're|you're|i'm|we're)\b/i.test(ans);
    const hasCasualWords = /\b(yeah|ok|okay|like|stuff|thing|guys|kinda|sorta|wanna|gonna|dunno)\b/i.test(ans);
    const wordCount = ans.split(/\s+/).length;
    if (wordCount > 30 && !hasContractions && !hasCasualWords) {
      heuristicBoost += 15;
      heuristicReasons.push("suspiciously formal language with no casual tone");
    }

    // Check 4: Markdown/formatting artifacts (STRONG copy-paste from AI indicator)
    // Beginners NEVER type markdown. If it's there, they copied from ChatGPT/Gemini.
    const markdownChecks = [
      { regex: /\*\*[^*]+\*\*/, label: "bold markdown (**text**)" },
      { regex: /__[^_]+__/, label: "bold markdown (__text__)" },
      { regex: /\*[^*]+\*/, label: "italic markdown (*text*)" },
      { regex: /^#{1,6}\s/m, label: "header markdown (### text)" },
      { regex: /^\s*[-*]\s/m, label: "bullet point markdown (- or *)" },
      { regex: /^\d+\.\s/m, label: "numbered list markdown (1. 2. 3.)" },
      { regex: /^---+$/m, label: "horizontal rule markdown (---)" },
      { regex: /```/, label: "code block markdown (```)" },
      { regex: /`[^`]+`/, label: "inline code markdown (`text`)" },
      { regex: /^>\s/m, label: "blockquote markdown (> text)" },
      { regex: /\[([^\]]+)\]\([^)]+\)/, label: "link markdown ([text](url))" },
    ];
    let markdownCount = 0;
    const markdownFound: string[] = [];
    for (const check of markdownChecks) {
      if (check.regex.test(ans)) {
        markdownCount++;
        markdownFound.push(check.label);
      }
    }
    if (markdownCount > 0) {
      // Each markdown artifact adds 15 points — multiple types = very likely AI
      heuristicBoost += Math.min(60, markdownCount * 15);
      heuristicReasons.push("contains " + markdownCount + " markdown artifacts: " + markdownFound.join(", "));
    }

    // Check 5: Very long answer for a beginner (100+ words is unusual for a noob)
    if (wordCount > 100) {
      heuristicBoost += 10;
      heuristicReasons.push("unusually long for a beginner (" + wordCount + " words)");
    }

    // Check 6: Structured response patterns (AI loves to structure answers)
    // Patterns like "Here are the first things I'd check, in order:" or "In simple terms"
    const aiStructurePhrases = [
      "here are", "in order", "in simple terms", "in summary",
      "the first thing", "the most important", "step 1", "step 2",
      "first,", "second,", "third,", "finally,", "in conclusion",
      "to summarize", "key takeaway", "the bottom line",
    ];
    for (const phrase of aiStructurePhrases) {
      if (lowerAns.includes(phrase)) {
        heuristicBoost += 8;
        heuristicReasons.push("uses AI-typical structure phrasing ('" + phrase + "')");
        break;
      }
    }

    // Check 7: Multiple paragraphs (beginners rarely write multi-paragraph answers)
    const paragraphCount = ans.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    if (paragraphCount >= 3 && wordCount > 50) {
      heuristicBoost += 12;
      heuristicReasons.push("multi-paragraph answer (" + paragraphCount + " paragraphs — unusual for a beginner)");
    }

    // Apply the boost (cap at 100)
    if (heuristicBoost > 0) {
      evaluation.plagiarismScore = Math.min(100, aiPlagiarism + heuristicBoost);
      if (heuristicReasons.length > 0) {
        evaluation.plagiarismNotes = evaluation.plagiarismNotes + " Heuristic flags: " + heuristicReasons.join(", ") + ".";
      }
    }
  } catch {
    // Heuristic fallback when AI is unavailable — be lenient with beginners.
    const len = ans.split(/\s+/).length;
    const correctness = Math.min(95, 55 + Math.min(40, Math.floor(len / 2)));
    evaluation = {
      correctness,
      feedback: `Answered with ${len} words. Manual review recommended — keep practicing, you're on the right track!`,
      level: "Beginner",
      gaps: ["Depth"],
      followUp: null,
      cognitiveLoad: "moderate",
      confidence: len > 50 ? "high" : "moderate",
      metacognitive: "moderate",
      plagiarismScore: 0,
      plagiarismNotes: "No signs of plagiarism detected.",
    };
  }

  // Persist the interaction.
  const interaction = await db.interaction.create({
    data: {
      userId: user.id,
      week: w,
      pillar: String(pillar ?? "Why Probe"),
      topic: String(topic ?? ""),
      question: String(question ?? ""),
      projectContext: String(projectContext ?? ""),
      studentAnswer: ans,
      timeTakenSeconds: Number(timeTakenSeconds ?? 0),
      answerLength: Number(wordCount ?? ans.split(/\s+/).length),
      correctness: evaluation.correctness,
      feedback: evaluation.feedback,
      level: evaluation.level,
      gaps: JSON.stringify(evaluation.gaps),
      followUp: evaluation.followUp,
      cognitiveLoad: evaluation.cognitiveLoad,
      confidence: evaluation.confidence,
      metacognitive: evaluation.metacognitive,
      plagiarismScore: evaluation.plagiarismScore,
    },
  });

  // Bump competency for this topic.
  const topicKey = String(topic ?? "General");
  const existing = await db.competency.findUnique({
    where: { userId_topic: { userId: user.id, topic: topicKey } },
  });
  if (existing) {
    const newAttempts = existing.attempts + 1;
    const newScore = Math.round((existing.score * existing.attempts + evaluation.correctness) / newAttempts);
    await db.competency.update({
      where: { id: existing.id },
      data: {
        score: newScore,
        attempts: newAttempts,
        level: evaluation.level,
        lastAssessed: new Date(),
      },
    });
  } else {
    await db.competency.create({
      data: {
        userId: user.id,
        topic: topicKey,
        score: evaluation.correctness,
        attempts: 1,
        level: evaluation.level,
        weakSubTopics: JSON.stringify(evaluation.gaps),
        lastAssessed: new Date(),
      },
    });
  }

  // Translate behavioral signals into plain-language insights
  const behavioralInsights = translateBehavioralSignals(
    evaluation.cognitiveLoad,
    evaluation.confidence,
    evaluation.metacognitive,
    evaluation.correctness
  );

  // Write to PsychologyObs — longitudinal behavioral tracking (previously dead table)
  try {
    await db.psychologyObs.create({
      data: {
        userId: user.id,
        week: w,
        confidence: evaluation.confidence,
        cognitiveLoad: evaluation.cognitiveLoad,
        metacognitive: evaluation.metacognitive,
        communication: evaluation.correctness >= 70 ? "clear" : "needs work",
        engagement: ans.split(/\s+/).length > 20 ? "high" : "moderate",
        learningCurve: evaluation.correctness >= 70 ? "improving" : "steady",
        remarks: `${pillar} · ${topic} · ${evaluation.correctness}%`,
      },
    });
  } catch {
    // Non-blocking — PsychologyObs is supplementary
  }

  return NextResponse.json({ evaluation, interaction, behavioralInsights });
}
