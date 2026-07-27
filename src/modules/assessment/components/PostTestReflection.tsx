"use client";

/**
 * PostTestReflection — shows the student a coaching reflection after
 * completing a daily or weekly test.
 *
 * This is the "testing as learning" feature the audit recommended:
 * instead of just showing a score, the student sees 2-3 sentences
 * generated from the same PsychEvidence the teacher sees, reframed
 * as growth-oriented coaching.
 *
 * Examples:
 *   "You were confident and right on Q1 — good calibration!"
 *   "You second-guessed a correct answer on Q3 — worth noticing."
 *   "Your answers showed step-by-step reasoning — that's exactly how
 *    professionals approach unknown problems."
 *
 * The reflection is sourced from:
 *   - ConfidenceRating (calibration signal — were you over/underconfident?)
 *   - PsychEvidence (cognitive load, explanatory depth, attribution)
 *   - Test score + answer length patterns
 *
 * Shown to the STUDENT only, in student-friendly language.
 * Never shows surveillance terms, never shows teacher-only data.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Sparkles, CheckCircle2, Lightbulb } from "lucide-react";

interface ReflectionData {
  score: number;
  testType: "practice" | "daily_test" | "weekly_test";
  reflections: Array<{
    type: "strength" | "growth" | "calibration" | "habit";
    title: string;
    message: string;
  }>;
  studyTip: string;
}

export function PostTestReflection({ score, testType }: { score: number; testType: "practice" | "daily_test" | "weekly_test" }) {
  const [data, setData] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate reflection from the student's recent psychological evidence
    // + confidence ratings. This is a client-side computation that reads
    // the same data the teacher sees, reframed for the student.
    setLoading(true);
    Promise.allSettled([
      api.get<{ evidence: Array<{ dimension: string; value: string; evidenceText: string; createdAt: string }> }>("/api/psych-evidence"),
      api.get<{ ratings: Array<{ rating: number; actualScore: number | null; source: string; createdAt: string }> }>("/api/confidence-ratings"),
      api.get<{ summary: { collaboration: number; contribution: number; communication: number; reliability: number; respect: number; overall: number; count: number } | null }>("/api/peer-assessment?mine=true"),
    ]).then(([evRes, crRes, paRes]) => {
      const evidence = evRes.status === "fulfilled" ? evRes.value.evidence || [] : [];
      const ratings = crRes.status === "fulfilled" ? crRes.value.ratings || [] : [];
      const peerSummary = paRes.status === "fulfilled" ? paRes.value.summary : null;

      const reflections = generateReflections(score, evidence, ratings, peerSummary);
      const studyTip = generateStudyTip(score, evidence);

      setData({ score, testType, reflections, studyTip });
    }).finally(() => setLoading(false));
  }, [score, testType]);

  if (loading) return null;
  if (!data || data.reflections.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card animate-success-burst">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> What This Told Us
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          A quick reflection on your thinking patterns from this test. This is coaching, not grading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.reflections.map((r, i) => {
          const Icon = r.type === "strength" ? CheckCircle2
            : r.type === "growth" ? Lightbulb
            : r.type === "calibration" ? Sparkles
            : TrendingUp;
          const color = r.type === "strength" ? "text-emerald-600"
            : r.type === "growth" ? "text-amber-600"
            : r.type === "calibration" ? "text-blue-600"
            : "text-violet-600";
          return (
            <div key={i} className="flex items-start gap-2">
              <Icon className={`h-4 w-4 ${color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className="text-xs font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.message}</p>
              </div>
            </div>
          );
        })}

        {/* Study tip — actionable next step */}
        <div className="mt-3 rounded-md bg-primary/10 border border-primary/20 p-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Try this next</p>
              <p className="text-xs text-muted-foreground">{data.studyTip}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Generate student-friendly reflections from evidence + ratings. */
function generateReflections(
  score: number,
  evidence: Array<{ dimension: string; value: string; evidenceText: string }>,
  ratings: Array<{ rating: number; actualScore: number | null }>,
  peerSummary: { collaboration: number; contribution: number; communication: number; reliability: number; respect: number; overall: number; count: number } | null,
): Array<{ type: "strength" | "growth" | "calibration" | "habit"; title: string; message: string }> {
  const reflections: Array<{ type: "strength" | "growth" | "calibration" | "habit"; title: string; message: string }> = [];

  // 1. Calibration reflection (Dunning-Kruger → student coaching)
  const withActual = ratings.filter(r => r.actualScore !== null);
  if (withActual.length > 0) {
    const avgConfidence = withActual.reduce((a, r) => a + r.rating * 20, 0) / withActual.length;
    const avgActual = withActual.reduce((a, r) => a + (r.actualScore ?? 0), 0) / withActual.length;
    const gap = avgConfidence - avgActual;

    if (gap > 20) {
      reflections.push({
        type: "calibration",
        title: "You were more confident than your scores show",
        message: `You rated your confidence at ~${Math.round(avgConfidence)}% but scored ~${Math.round(avgActual)}%. This is common when a topic feels familiar but has hidden depth. Try explaining the concept out loud before answering — if you can't explain it simply, you might not know it as well as you think.`,
      });
    } else if (gap < -20) {
      reflections.push({
        type: "calibration",
        title: "You know more than you think",
        message: `You rated your confidence at ~${Math.round(avgConfidence)}% but scored ~${Math.round(avgActual)}%. You're second-guessing yourself. Trust your instincts more — your answers are better than your confidence suggests.`,
      });
    } else {
      reflections.push({
        type: "calibration",
        title: "Good calibration!",
        message: `Your confidence (~${Math.round(avgConfidence)}%) matches your actual performance (~${Math.round(avgActual)}%). Knowing what you know and what you don't is a real skill — keep it up.`,
      });
    }
  }

  // 2. Score-based reflection
  if (score >= 85) {
    reflections.push({
      type: "strength",
      title: "Strong understanding",
      message: `You scored ${score}% — you clearly understand this material. Consider helping a classmate who's struggling (teaching is the best way to deepen your own knowledge).`,
    });
  } else if (score >= 60) {
    reflections.push({
      type: "growth",
      title: "Almost there",
      message: `You scored ${score}% — you've got the basics but some gaps remain. Review the questions you got wrong and try to explain why the right answer is right in your own words.`,
    });
  } else {
    reflections.push({
      type: "growth",
      title: "This topic needs more practice",
      message: `You scored ${score}% — don't worry, this just means you haven't had enough practice yet. Try the practice questions on this topic, and ask your teacher for help if you're stuck. Every expert started here.`,
    });
  }

  // 3. Cognitive load reflection (from PsychEvidence)
  const loadEvidence = evidence.find(e => e.dimension === "cognitive_load");
  if (loadEvidence) {
    if (loadEvidence.value === "high_intrinsic") {
      reflections.push({
        type: "habit",
        title: "This material is genuinely hard",
        message: "The difficulty you're feeling isn't a sign you can't do it — it means the material itself is complex. Break it into smaller pieces and tackle one concept at a time.",
      });
    } else if (loadEvidence.value === "low_germane") {
      reflections.push({
        type: "strength",
        title: "You've mastered this — ready for more",
        message: "You're handling this material with ease. Consider exploring advanced topics or applied projects to keep growing.",
      });
    }
  }

  // 4. Explanatory depth reflection
  const depthEvidence = evidence.find(e => e.dimension === "explanatory_depth");
  if (depthEvidence) {
    if (depthEvidence.value === "detailed_reasoning") {
      reflections.push({
        type: "strength",
        title: "Your reasoning is clear",
        message: "You explain your thinking step by step — that's exactly how professionals approach problems. This habit will serve you well in interviews and real projects.",
      });
    } else if (depthEvidence.value === "surface_answers") {
      reflections.push({
        type: "growth",
        title: "Try to explain your reasoning more",
        message: "Your answers are short. Even if you know the answer, explaining WHY helps you remember it and shows your teacher you understand. Try adding 'because...' to your answers.",
      });
    }
  }

  // 5. Peer collaboration reflection (from peer assessments)
  if (peerSummary && peerSummary.count > 0) {
    if (peerSummary.overall >= 4) {
      reflections.push({
        type: "strength",
        title: "Your teammates value working with you",
        message: `Your peers rated your collaboration ${peerSummary.overall}/5 — you're a strong team player. This is a skill employers look for as much as technical ability.`,
      });
    } else if (peerSummary.overall < 3) {
      reflections.push({
        type: "growth",
        title: "Teamwork is an area to grow",
        message: `Your peers rated your collaboration ${peerSummary.overall}/5. Consider asking for feedback directly — small adjustments in communication or reliability can make a big difference.`,
      });
    }
  }

  return reflections.slice(0, 4); // cap at 4 to keep it readable
}

/** Generate an actionable study tip based on score + evidence. */
function generateStudyTip(score: number, evidence: Array<{ dimension: string; value: string }>): string {
  if (score >= 85) {
    return "Try teaching this topic to someone else — it'll reveal any hidden gaps and deepen your understanding.";
  }
  if (score < 50) {
    return "Start with the easiest practice question on this topic. Get one right, then build up. Don't jump to the hard ones until the basics feel natural.";
  }
  const hasDepthIssue = evidence.some(e => e.dimension === "explanatory_depth" && e.value === "surface_answers");
  if (hasDepthIssue) {
    return "Next time you practice, write your answer as if explaining to a 10-year-old. If you can't explain it simply, you don't understand it well enough yet.";
  }
  return "Review the questions you got wrong and write a one-sentence explanation of why the right answer is correct. This active recall is more effective than re-reading.";
}
