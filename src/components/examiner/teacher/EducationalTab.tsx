"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ReferenceLine, Cell,
} from "recharts";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import type { PortfolioData } from "@/components/examiner/teacher/types";
import { computeMasteryFromInteractions } from "@/components/examiner/teacher/computeMasteryFromInteractions";

export function EducationalTab({ portfolio }: { portfolio: PortfolioData }) {
  const [mastery, setMastery] = useState<{ id: string; topic: string; pillar: string; masteryLevel: string; evidenceCount: number; lastAssessedWeek: number | null; trend: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const c = useChartColors();

  useEffect(() => {
    if (!portfolio?.student?.id) return;
    setLoading(true);
    api.get<{ mastery: typeof mastery }>(`/api/skill-mastery?userId=${portfolio.student.id}`)
      .then((res) => setMastery(res.mastery || []))
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, [portfolio?.student?.id]);

  // Compute mastery from interactions if API hasn't returned any (fallback)
  const computedMastery = mastery.length > 0 ? mastery : computeMasteryFromInteractions(portfolio.interactions);

  // Group by pillar for rollup
  const byPillar = computedMastery.reduce<Record<string, typeof computedMastery>>((acc, m) => {
    if (!acc[m.pillar]) acc[m.pillar] = [];
    acc[m.pillar].push(m);
    return acc;
  }, {});

  // Mastery level colors
  const masteryColor = (level: string) =>
    level === "mastered" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : level === "proficient" ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
    : level === "developing" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
    : "bg-muted text-muted-foreground";

  // Score trend chart (migrated from BehavioralTrendsTab)
  const weekChartData = Array.from({ length: 12 }, (_, i) => i + 1).map(w => {
    const wt = portfolio.weeklyTests.find(t => t.week === w);
    const weekInteractions = portfolio.interactions.filter(i => i.week === w);
    const practiceAvg = weekInteractions.length > 0
      ? Math.round(weekInteractions.reduce((a, i) => a + i.correctness, 0) / weekInteractions.length)
      : null;
    return { week: `W${w}`, weeklyTest: wt?.status === "completed" && wt.score !== null ? wt.score : null, practice: practiceAvg, practiceCount: weekInteractions.length };
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Overall course progress + glanceable mastery grid */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Academic Mastery
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            What {portfolio.student.name} knows and can do — topic-level specificity, not just week-level percentages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Course progress</span>
              <span className="text-xs font-medium text-foreground">{portfolio.progress}% · Week {portfolio.student.currentWeek}</span>
            </div>
            <Progress value={portfolio.progress} className="h-1.5" />
          </div>

          {/* Mastery grid — glanceable */}
          {computedMastery.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No mastery data yet. Data populates as the student completes practice questions and weekly tests.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {computedMastery.map(m => (
                <button
                  key={m.id}
                  onClick={() => setExpandedTopic(expandedTopic === m.id ? null : m.id)}
                  className={`text-left rounded-md border p-2 transition-colors hover:bg-muted/30 ${expandedTopic === m.id ? "border-primary" : "border-border"}`}
                >
                  <p className="text-xs font-medium text-foreground truncate">{m.topic}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className={`text-[9px] ${masteryColor(m.masteryLevel)}`}>{m.masteryLevel}</Badge>
                    {m.trend === "improving" && <span className="text-[10px] text-emerald-600">↗</span>}
                    {m.trend === "declining" && <span className="text-[10px] text-red-600">↘</span>}
                    {m.trend === "stable" && <span className="text-[10px] text-muted-foreground">→</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Topic detail — expandable */}
          {expandedTopic && (() => {
            const m = computedMastery.find(x => x.id === expandedTopic);
            if (!m) return null;
            const relatedInteractions = portfolio.interactions.filter(i => i.topic === m.topic);
            return (
              <div className="mt-3 rounded-md bg-muted/30 border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{m.topic}</p>
                  <Badge variant="outline" className={`text-[9px] ${masteryColor(m.masteryLevel)}`}>{m.masteryLevel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pillar: {m.pillar} · Evidence count: {m.evidenceCount}
                  {m.lastAssessedWeek !== null && ` · Last assessed: Week ${m.lastAssessedWeek}`}
                  {" · Trend: "}<span className="capitalize">{m.trend}</span>
                </p>
                {relatedInteractions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Recent interactions on this topic:</p>
                    {relatedInteractions.slice(0, 5).map(i => (
                      <div key={i.id} className="text-xs rounded bg-background p-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Week {i.week} · {i.level}</span>
                          <span className={`font-bold ${i.correctness >= 80 ? "text-emerald-600" : i.correctness >= 60 ? "text-amber-600" : "text-red-600"}`}>{i.correctness}%</span>
                        </div>
                        <p className="text-foreground mt-0.5 line-clamp-2">{i.question}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Actionable: generate targeted practice on this topic */}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => {
                    // Link to practice tab with this topic pre-selected — low-friction actionability
                    if (typeof window !== "undefined") {
                      window.open(`/?view=question&topic=${encodeURIComponent(m.topic)}`, "_self");
                    }
                  }}
                >
                  <HelpCircle className="h-3 w-3" /> Generate targeted practice on "{m.topic}"
                </Button>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Phase Three-Tab Redesign: Skill Mastery RADAR CHART by pillar */}
      {Object.keys(byPillar).length > 1 && (() => {
        // Aggregate mastery into 0-100 numeric per pillar for the radar
        const levelToNum: Record<string, number> = { "mastered": 100, "proficient": 82, "developing": 60, "not-started": 25 };
        const radarData = Object.entries(byPillar).map(([pillar, items]) => {
          const avg = items.reduce((sum, m) => sum + (levelToNum[m.masteryLevel] ?? 50), 0) / items.length;
          return { pillar: pillar.length > 15 ? pillar.slice(0, 15) + "…" : pillar, mastery: Math.round(avg) };
        });
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Skill Mastery by Pillar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Radar shows the SHAPE of strengths/gaps at a glance — equal shape = balanced readiness, dents = weakness areas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={c.grid} />
                  <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10, fill: c.axis }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: c.axis }} />
                  <Radar name="Mastery" dataKey="mastery" stroke={c.chart1} fill={c.chart1} fillOpacity={0.4} />
                  <Tooltip contentStyle={tooltipStyle(c)} formatter={(value: number) => [`${value}%`, "Mastery"]} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pillar rollup — aggregate mastery by pillar */}
      {Object.keys(byPillar).length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Pillar Rollup</CardTitle>
            <CardDescription className="text-muted-foreground">Portfolio-level view — overall readiness by pillar category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byPillar).map(([pillar, items]) => {
              const mastered = items.filter(m => m.masteryLevel === "mastered").length;
              const proficient = items.filter(m => m.masteryLevel === "proficient").length;
              const developing = items.filter(m => m.masteryLevel === "developing").length;
              const notStarted = items.filter(m => m.masteryLevel === "not-started").length;
              const isOpen = expandedPillar === pillar;
              return (
                <div key={pillar} className="rounded-md border border-border">
                  <button
                    onClick={() => setExpandedPillar(isOpen ? null : pillar)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30"
                  >
                    <span className="text-sm font-medium text-foreground">{pillar}</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      {mastered > 0 && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{mastered} mastered</Badge>}
                      {proficient > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">{proficient} proficient</Badge>}
                      {developing > 0 && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{developing} developing</Badge>}
                      {notStarted > 0 && <Badge variant="outline" className="bg-muted text-muted-foreground">{notStarted} not started</Badge>}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-2 space-y-1 bg-muted/20">
                      {items.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{m.topic}</span>
                          <Badge variant="outline" className={`text-[9px] ${masteryColor(m.masteryLevel)}`}>{m.masteryLevel}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Score trend chart (migrated from old BehavioralTrendsTab) */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Score Trend</CardTitle>
          <CardDescription className="text-muted-foreground">Weekly test + practice average over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={weekChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis dataKey="week" stroke={c.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={c.axis} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle(c)} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Line type="monotone" dataKey="weeklyTest" stroke={c.chart1} name="Weekly Test" connectNulls strokeWidth={2} />
              <Line type="monotone" dataKey="practice" stroke={c.chart2} name="Practice Avg" connectNulls strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Week-by-week table (migrated from old BehavioralTrendsTab) */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base text-foreground">Week-by-Week</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 px-2 font-medium">Week</th>
                  <th className="text-left py-1.5 px-2 font-medium">Test Score</th>
                  <th className="text-left py-1.5 px-2 font-medium">Practice Avg</th>
                  <th className="text-left py-1.5 px-2 font-medium">Practice Count</th>
                </tr>
              </thead>
              <tbody>
                {weekChartData.map(w => (
                  <tr key={w.week} className="border-b border-border">
                    <td className="py-1.5 px-2 text-foreground">{w.week}</td>
                    <td className="py-1.5 px-2 text-foreground">{w.weeklyTest ?? "—"}</td>
                    <td className="py-1.5 px-2 text-foreground">{w.practice ?? "—"}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{w.practiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
