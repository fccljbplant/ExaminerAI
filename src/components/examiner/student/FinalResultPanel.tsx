"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scoreToGrade, gradeColor, PILLARS } from "@/lib/constants";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";

export function FinalResultPanel() {
  const [data, setData] = useState<{
    studentName: string;
    performanceScore: number;
    performanceGrade: string;
    participationRate: number;
    participationGrade: string;
    questionsAnswered: number;
    totalPossibleQuestions: number;
    weeklyTestsCompleted: number;
    weeklyAvg: number;
    practiceAvg: number;
    totalPracticeQuestions: number;
    avgPlagiarism: number;
    weekBreakdown: { week: number; phase: string; weeklyTestScore: number | null; weeklyTestStatus: string; questionsAnswered: number; practiceCount: number; practiceAvg: number | null; plagiarismScore: number | null }[];
    behavioralPattern: string;
    areasToImprove: string[];
    overallAssessment: string;
    careerReadiness: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{
      studentName: string;
      performanceScore: number;
      performanceGrade: string;
      participationRate: number;
      participationGrade: string;
      questionsAnswered: number;
      totalPossibleQuestions: number;
      weeklyTestsCompleted: number;
      weeklyAvg: number;
      practiceAvg: number;
      totalPracticeQuestions: number;
      avgPlagiarism: number;
      weekBreakdown: { week: number; phase: string; weeklyTestScore: number | null; weeklyTestStatus: string; questionsAnswered: number; practiceCount: number; practiceAvg: number | null; plagiarismScore: number | null }[];
      behavioralPattern: string;
      areasToImprove: string[];
      overallAssessment: string;
      careerReadiness: string;
    }>("/api/students/final-result")
      .then((r) => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Generating final result...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-background">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Final Bootcamp Result - {data.studentName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Based on {data.weeklyTestsCompleted}/{Math.ceil(data.totalPossibleQuestions / 10)} weekly tests + {data.totalPracticeQuestions} practice questions. Auto-updates after every test.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Two grades side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Performance Grade */}
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-primary">Performance Grade</p>
            <p className={"text-3xl font-bold " + gradeColor(data.performanceGrade)}>{data.performanceGrade}</p>
            <p className="text-sm font-semibold text-foreground">{data.performanceScore}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Based on test scores (50% weekly + 50% practice)</p>
          </div>
          {/* Participation Grade */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-blue-600">Participation Grade</p>
            <p className={"text-3xl font-bold " + gradeColor(data.participationGrade)}>{data.participationGrade}</p>
            <p className="text-sm font-semibold text-foreground">{data.participationRate}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{data.questionsAnswered} of {data.totalPossibleQuestions} questions answered</p>
          </div>
        </div>

        {/* SDT: Career Readiness badge only shown when the student has completed
            at least 50% of their tests. Showing "Not Ready" to a Week-1 student
            is psychologically brutal and doesn't help them. */}
        {data.weeklyTestsCompleted >= Math.ceil(data.totalPossibleQuestions / 20) && (
          <div className="flex items-center justify-center">
            <Badge variant="outline" className={"text-sm font-bold px-4 py-1.5 " + (
              data.careerReadiness === "Ready" ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" :
              data.careerReadiness === "Almost Ready" ? "border-amber-500/40 text-amber-600 bg-amber-500/10" :
              "border-amber-500/40 text-amber-600 bg-amber-500/10"
            )}>
              {data.careerReadiness || "Pending"}
            </Badge>
          </div>
        )}

        {/* SDT rebalance: Average Plagiarism Risk hidden from student — teacher only.
            The old UI showed this permanently on the report card, which made students
            feel surveilled even when their score was low. Teachers see it in the portfolio. */}

        {/* Behavioral Pattern Analysis */}
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-600" /> Your Learning Style
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">{data.behavioralPattern || "Not enough data yet."}</p>
        </div>

        {/* Overall Assessment */}
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs font-bold text-primary mb-1.5">Overall Assessment</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{data.overallAssessment || "Continue completing tests for a full assessment."}</p>
        </div>

        {/* Areas to Improve */}
        {(data.areasToImprove || []).length > 0 && (
          <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
            <p className="text-xs font-bold text-amber-600 mb-1.5">What to Try Next</p>
            <ul className="space-y-1">
              {(data.areasToImprove || []).map((area, i) => (
                <li key={i} className="text-sm text-foreground/80 flex items-start gap-1.5">
                  <span className="text-amber-600 mt-0.5">→</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-week breakdown table */}
        <div className="rounded-md border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground">Per-Week Breakdown ({data.totalPossibleQuestions} questions total, 10 per week)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 px-2 font-medium">Week</th>
                  <th className="text-left py-1.5 px-2 font-medium">Phase</th>
                  <th className="text-left py-1.5 px-2 font-medium">Test Score</th>
                  <th className="text-left py-1.5 px-2 font-medium">Q Answered</th>
                  <th className="text-left py-1.5 px-2 font-medium">Practice</th>
                  <th className="text-left py-1.5 px-2 font-medium">Plagiarism</th>
                </tr>
              </thead>
              <tbody>
                {(data.weekBreakdown || []).map((w) => (
                  <tr key={w.week} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 px-2 font-medium text-foreground">W{w.week}</td>
                    <td className="py-1.5 px-2 text-muted-foreground text-[10px]">{w.phase.length > 25 ? w.phase.slice(0, 25) + "…" : w.phase}</td>
                    <td className="py-1.5 px-2">
                      {w.weeklyTestScore !== null ? (
                        <span className={"font-bold " + gradeColor(scoreToGrade(w.weeklyTestScore))}>{w.weeklyTestScore}%</span>
                      ) : (
                        <span className="text-muted-foreground/50 text-[10px]">{w.weeklyTestStatus}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-foreground/80">{w.questionsAnswered}/10</td>
                    <td className="py-1.5 px-2 text-muted-foreground">
                      {w.practiceCount > 0 ? w.practiceCount + " Q, " + w.practiceAvg + "%" : "-"}
                    </td>
                    <td className="py-1.5 px-2">
                      {w.plagiarismScore != null && w.plagiarismScore > 0 ? (
                        <span className={"font-bold " + (w.plagiarismScore > 40 ? "text-red-600" : "text-amber-600")}>{w.plagiarismScore}%</span>
                      ) : (
                        <span className="text-emerald-600 text-[10px]">Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted p-2">
            <p className="text-[10px] text-muted-foreground">Weekly Avg</p>
            <p className="text-lg font-bold text-foreground">{data.weeklyAvg}%</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-[10px] text-muted-foreground">Practice Avg</p>
            <p className="text-lg font-bold text-foreground">{data.practiceAvg}%</p>
          </div>
          <div className="rounded-md bg-muted p-2">
            <p className="text-[10px] text-muted-foreground">Total Replies</p>
            <p className="text-lg font-bold text-foreground">{data.questionsAnswered}/{data.totalPossibleQuestions}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
