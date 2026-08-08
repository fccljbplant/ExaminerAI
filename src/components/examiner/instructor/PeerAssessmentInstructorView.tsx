"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";

export function PeerAssessmentInstructorView({ groupTaskId }: { groupTaskId: string }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ assessments: any[] }>(`/api/peer-assessment?groupTaskId=${groupTaskId}`)
      .then((res) => setAssessments(res.assessments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupTaskId]);

  if (loading) return null;
  if (assessments.length === 0) return null;

  // Aggregate per assessee
  const byAssessee = new Map<string, { name: string; ratings: any[] }>();
  for (const a of assessments) {
    const key = a.assesseeId;
    if (!byAssessee.has(key)) byAssessee.set(key, { name: a.assessee?.name || "Unknown", ratings: [] });
    byAssessee.get(key)!.ratings.push(a);
  }

  const dims = ["collaboration", "contribution", "communication", "reliability", "respect"] as const;
  type Dim = (typeof dims)[number];

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader>
        <CardTitle className="text-sm text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-500" /> Peer Assessment Results
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Students rated each other on 5 dimensions. Feeds automatically into Psychological + Educational tabs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from(byAssessee.entries()).map(([userId, data]) => {
          const avg = (key: Dim) =>
            Math.round((data.ratings.reduce((a, r) => a + r[key], 0) / data.ratings.length) * 10) / 10;
          const overall = Math.round(((avg("collaboration") + avg("contribution") + avg("communication") + avg("reliability") + avg("respect")) / 5) * 10) / 10;
          return (
            <div key={userId} className="rounded-md bg-background border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">{data.name}</p>
                <Badge variant="outline" className={`text-[9px] ${overall >= 4 ? "bg-growth-sage-soft text-growth-sage border-growth-sage" : overall >= 3 ? "bg-growth-amber-soft text-growth-amber border-growth-amber" : "bg-destructive/5 text-destructive border-destructive/30"}`}>
                  Overall: {overall}/5
                </Badge>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {dims.map(d => (
                  <div key={d} className="text-center">
                    <p className="text-[9px] text-muted-foreground capitalize">{d.slice(0, 4)}</p>
                    <p className={`text-sm font-bold ${avg(d) >= 4 ? "text-growth-sage" : avg(d) >= 3 ? "text-growth-amber" : "text-destructive"}`}>{avg(d)}</p>
                  </div>
                ))}
              </div>
              {/* Text feedback */}
              {data.ratings.some((r: any) => r.textFeedback) && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-[9px] text-muted-foreground mb-1">Feedback (anonymous to student):</p>
                  {data.ratings.filter((r: any) => r.textFeedback).map((r: any, i: number) => (
                    <p key={i} className="text-[10px] text-foreground italic">"{r.textFeedback}"</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
