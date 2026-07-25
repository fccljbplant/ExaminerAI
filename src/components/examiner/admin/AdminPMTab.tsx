"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";
import type { UserRow } from "@/components/examiner/admin/types";

export function AdminPMTab({ users, students, pending }: { users: UserRow[]; students: UserRow[]; pending: UserRow[] }) {
  const [aiStats, setAiStats] = useState<{ tokens?: { total: number }; usage24h?: { calls: number; successRate: number }; cache?: { hitRate: number } } | null>(null);
  const [healthStatus, setHealthStatus] = useState<{ status: string; checks: { db: boolean; ai: boolean; jwt: boolean } } | null>(null);

  useEffect(() => {
    api.get<{ tokens?: { total: number }; usage24h?: { calls: number; successRate: number }; cache?: { hitRate: number } }>("/api/ai/stats").then((r) => setAiStats(r)).catch(() => {});
    fetch("/api/health").then(r => r.json()).then((d) => setHealthStatus(d)).catch(() => {});
  }, []);

  // Action items: pending approvals + blocked users + students with no project
  const actionItems: Array<{ priority: string; task: string; count: number }> = [];
  if (pending.length > 0) actionItems.push({ priority: "high", task: "Approve pending users", count: pending.length });
  const noProject = students.filter(s => !s.projectName);
  if (noProject.length > 0) actionItems.push({ priority: "medium", task: "Students with no project started", count: noProject.length });

  return (
    <div className="space-y-4">
      {/* Action items */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Action Items
          </CardTitle>
          <CardDescription className="text-muted-foreground">What needs to happen today</CardDescription>
        </CardHeader>
        <CardContent>
          {actionItems.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-foreground">All caught up — no pending action items.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Badge variant="outline" className={`text-[9px] ${item.priority === "high" ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                    {item.priority}
                  </Badge>
                  <span className="text-sm text-foreground flex-1">{item.task}</span>
                  <Badge variant="outline" className="text-[10px]">{item.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System health */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthStatus ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${healthStatus.checks.db ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="text-[10px] text-muted-foreground mt-1">Database</span>
              </div>
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${healthStatus.checks.ai ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-[10px] text-muted-foreground mt-1">AI Provider</span>
              </div>
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${healthStatus.checks.jwt ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-[10px] text-muted-foreground mt-1">JWT Secret</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading health status…</p>
          )}
          {!healthStatus?.checks.ai && (
            <p className="text-[10px] text-amber-600 mt-2">⚠ AI provider not configured — set DEEPSEEK_API_KEY in Vercel env vars</p>
          )}
          {!healthStatus?.checks.jwt && (
            <p className="text-[10px] text-amber-600 mt-1">⚠ JWT secret not set — set JWT_SECRET in Vercel env vars</p>
          )}
        </CardContent>
      </Card>

      {/* AI usage summary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> AI Usage
          </CardTitle>
          <CardDescription className="text-muted-foreground">Token consumption + cost trends</CardDescription>
        </CardHeader>
        <CardContent>
          {aiStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-[10px] text-muted-foreground">Calls (24h)</p><p className="text-lg font-bold text-foreground">{aiStats.usage24h?.calls ?? "—"}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Total Tokens</p><p className="text-lg font-bold text-foreground">{aiStats.tokens?.total?.toLocaleString() ?? "—"}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Success Rate</p><p className="text-lg font-bold text-foreground">{aiStats.usage24h?.successRate ? `${aiStats.usage24h.successRate}%` : "—"}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Cache Hit Rate</p><p className="text-lg font-bold text-foreground">{aiStats.cache?.hitRate ? `${aiStats.cache.hitRate}%` : "—"}</p></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading AI stats…</p>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Operations Shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a href="/?view=admin-system" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
            <Server className="h-3 w-3" /> Struggle Detection
          </a>
          <a href="/api/health" target="_blank" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
            <Activity className="h-3 w-3" /> Health Check API
          </a>
          <a href="/?view=admin-users" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
            <Users className="h-3 w-3" /> User Management
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
