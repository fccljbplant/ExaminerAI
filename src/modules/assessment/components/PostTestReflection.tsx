"use client";

/**
 * PostTestReflection — shows the student a brief coaching reflection after
 * completing a daily or weekly test.
 *
 * This is the "testing as learning" feature the audit recommended:
 * instead of just showing a score, the student sees 2-3 sentences
 * reframed as growth-oriented coaching, based purely on their score
 * and the test type.
 *
 * Examples:
 *   "You scored 85% — strong understanding. Consider teaching this topic
 *    to a classmate to deepen your knowledge."
 *   "You scored 55% — this topic needs more practice. Try the practice
 *    questions and ask your instructor for help."
 *
 * Shown to the STUDENT only, in student-friendly language.
 * No surveillance, no behavioral analysis, no psych data.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, TrendingUp, TrendingDown, Sparkles, CheckCircle2, Lightbulb } from "lucide-react";

interface ReflectionData {
  score: number;
  testType: "practice" | "daily_test" | "weekly_test";
  reflections: Array<{
    type: "strength" | "growth";
    title: string;
    message: string;
  }>;
  studyTip: string;
}

export function PostTestReflection({ score, testType }: { score: number; testType: "practice" | "daily_test" | "weekly_test" }) {
  const [data] = useState<ReflectionData>(() => {
    const reflections = generateReflections(score);
    const studyTip = generateStudyTip(score);
    return { score, testType, reflections, studyTip };
  });

  if (!data || data.reflections.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card animate-success-burst">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> What This Told Us
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          A quick reflection on this test. This is coaching, not grading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.reflections.map((r, i) => {
          const Icon = r.type === "strength" ? CheckCircle2 : Lightbulb;
          const color = r.type === "strength" ? "text-growth-sage" : "text-growth-amber";
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

/** Generate student-friendly reflections from the test score. */
function generateReflections(
  score: number,
): Array<{ type: "strength" | "growth"; title: string; message: string }> {
  const reflections: Array<{ type: "strength" | "growth"; title: string; message: string }> = [];

  // Score-based reflection
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
      message: `You scored ${score}% — don't worry, this just means you haven't had enough practice yet. Try the practice questions on this topic, and ask your instructor for help if you're stuck. Every expert started here.`,
    });
  }

  return reflections.slice(0, 4); // cap at 4 to keep it readable
}

/** Generate an actionable study tip based on score. */
function generateStudyTip(score: number): string {
  if (score >= 85) {
    return "Try teaching this topic to someone else — it'll reveal any hidden gaps and deepen your understanding.";
  }
  if (score < 50) {
    return "Start with the easiest practice question on this topic. Get one right, then build up. Don't jump to the hard ones until the basics feel natural.";
  }
  return "Review the questions you got wrong and write a one-sentence explanation of why the right answer is correct. This active recall is more effective than re-reading.";
}
