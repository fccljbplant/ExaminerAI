"use client";

/**
 * TeacherBehaviorTab — admin/principal panel showing teacher AI Assistant
 * usage + behavioral signals.
 *
 * Displays:
 *  - Per-teacher summary: session count, last active, avg session length
 *  - Recent sessions (last 100): teacher name, topic, message count, preview,
 *    behavioral signals, psych analysis
 *
 * Data source: /api/admin/teacher-behavior (reads ChatSession rows where
 * chatbotType="teacher_tutor").
 *
 * Visibility: principal + administrator only (pastoral data, not technical).
 * Developer is excluded — this is teacher behavioral data, not system logs.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, RefreshCw, MessageSquare, Clock, Activity, Brain } from "lucide-react";

interface SessionPreview {
  role: string;
  content: string;
  timestamp?: string;
}

interface Session {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherRole: string;
  topic: string | null;
  status: string;
  createdAt: string;
  messageCount: number;
  preview: SessionPreview[];
  behavioralSignals: Record<string, unknown> | null;
  psychAnalysis: string | null;
}

interface TeacherSummary {
  teacherId: string;
  name: string;
  email: string;
  role: string;
  sessionCount: number;
  lastActive: string | null;
  totalMessages: number;
  avgSessionLength: number;
}

interface TeacherBehaviorData {
  sessions: Session[];
  summary: TeacherSummary[];
  totalSessions: number;
  uniqueTeachers: number;
}

export function TeacherBehaviorTab() {
  const [data, setData] = useState<TeacherBehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<TeacherBehaviorData>("/api/admin/teacher-behavior");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teacher behavior data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No teacher AI Assistant sessions yet. When teachers use the AI Assistant tab,
            their sessions + behavioral signals will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-bold text-foreground">{data.totalSessions}</div>
              <div className="text-[10px] text-muted-foreground">Total Sessions</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-violet-500" />
            <div>
              <div className="text-lg font-bold text-foreground">{data.uniqueTeachers}</div>
              <div className="text-[10px] text-muted-foreground">Active Teachers</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div>
              <div className="text-lg font-bold text-foreground">
                {data.summary.reduce((a, t) => a + t.totalMessages, 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Total Messages</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-500" />
            <Button onClick={load} variant="ghost" size="sm" className="text-xs h-7">
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Per-teacher summary table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Teacher AI Assistant Usage
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Per-teacher aggregate of AI Assistant sessions. Behavioral signals (engagement, language, topic drift) feed into the same pipeline as student tests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 px-3">Teacher</th>
                  <th className="text-left py-2 px-3">Role</th>
                  <th className="text-left py-2 px-3">Sessions</th>
                  <th className="text-left py-2 px-3">Avg Length</th>
                  <th className="text-left py-2 px-3">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map(t => (
                  <tr key={t.teacherId} className="border-b border-border hover:bg-muted/50">
                    <td className="py-2 px-3">
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground">{t.email}</div>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[9px]">{t.role}</Badge>
                    </td>
                    <td className="py-2 px-3 text-foreground">{t.sessionCount}</td>
                    <td className="py-2 px-3 text-muted-foreground">{t.avgSessionLength} msgs</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {t.lastActive ? new Date(t.lastActive).toLocaleDateString() + " " + new Date(t.lastActive).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent sessions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Recent Sessions
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Last 100 AI Assistant turns. Click a session to expand the conversation preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.sessions.slice(0, 20).map(s => (
            <div key={s.id} className="rounded-lg border border-border bg-card/50 p-3">
              <button
                onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                className="w-full text-left flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{s.teacherName}</span>
                    <Badge variant="outline" className="text-[9px]">{s.teacherRole}</Badge>
                    <Badge variant="outline" className="text-[9px] bg-primary/5">{s.messageCount} msgs</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(s.createdAt).toLocaleString()} · {s.topic || "AI Assistant session"}
                  </div>
                </div>
                {s.psychAnalysis && (
                  <Badge variant="outline" className="text-[9px] bg-violet-500/10 text-violet-600 border-violet-500/30 flex-shrink-0">
                    <Brain className="h-2.5 w-2.5 mr-0.5" /> Psych
                  </Badge>
                )}
              </button>
              {expandedSession === s.id && (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  {s.preview.map((m, i) => (
                    <div key={i} className="text-xs">
                      <span className={`font-semibold ${m.role === "student" ? "text-primary" : "text-foreground"}`}>
                        {m.role === "student" ? "Teacher" : "AI"}:
                      </span>
                      <span className="text-muted-foreground ml-1.5">{m.content.slice(0, 200)}{m.content.length > 200 ? "…" : ""}</span>
                    </div>
                  ))}
                  {s.psychAnalysis && (
                    <div className="mt-2 rounded-md bg-violet-500/5 border border-violet-500/20 p-2 text-xs">
                      <div className="font-semibold text-violet-700 dark:text-violet-300 mb-1">Psych Analysis</div>
                      <p className="text-muted-foreground">{s.psychAnalysis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
