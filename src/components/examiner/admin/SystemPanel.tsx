"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";
import type { UserRow } from "@/components/examiner/admin/types";
import { LayoutDashboard } from "@/components/examiner/admin/LayoutDashboard";
import { AIConnectionPanel } from "@/components/examiner/admin/AIConnectionPanel";
import { AuditLogPanel } from "@/components/examiner/admin/AuditLogPanel";
import { AccessGrantsPanel } from "@/components/examiner/admin/AccessGrantsPanel";
import { RoleNavConfigPanel } from "@/components/examiner/admin/RoleNavConfigPanel";

export function SystemPanel({ users }: { users: UserRow[] }) {
  const [apiChecks, setApiChecks] = useState<{ name: string; ok: boolean; ms: number; error?: string }[]>([]);
  const [checking, setChecking] = useState(false);
  const [aiStats, setAiStats] = useState<any>(null);
  const [alertResult, setAlertResult] = useState<{ studentsScanned: number; messagesCreated: number; messages: Array<{ type: string; toName: string; subject: string }> } | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  // Phase 8: New state for env var status + DB table counts + feature flags
  const [health, setHealth] = useState<{ status: string; checks: { db: boolean; ai: boolean; jwt: boolean }; version: string } | null>(null);
  const [dbCounts, setDbCounts] = useState<Record<string, number> | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [featureBusy, setFeatureBusy] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; hits: number; misses: number; hitRate: number; estimatedTokensSaved: number } | null>(null);
  const [cleanupPreview, setCleanupPreview] = useState<{ wouldDelete: Record<string, number>; totalWouldDelete: number; kept: Record<string, number> } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "ai" | "flags" | "actions" | "audit" | "access" | "navconfig" | "maintenance">("overview");

  const loadAiStats = useCallback(async () => {
    try { const res = await api.get<any>("/api/ai/stats"); setAiStats(res); } catch { /* ignore */ }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch { /* ignore */ }
  }, []);

  const loadDbCounts = useCallback(async () => {
    try {
      // Use the admin cleanup route to get table counts
      const res = await api.get<any>("/api/admin/cleanup");
      if (res.tables) setDbCounts(res.tables);
    } catch { /* ignore */ }
  }, []);

  const loadFeatures = useCallback(async () => {
    try {
      const res = await api.get<{ features: Record<string, boolean> }>("/api/settings/features");
      setFeatures(res.features || {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadAiStats();
    loadHealth();
    loadFeatures();
    loadDbCounts();
  }, [loadAiStats, loadHealth, loadFeatures, loadDbCounts]);

  const runChecks = async () => {
    setChecking(true);
    const checks = [
      { name: "GET /api/auth/me", url: "/api/auth/me" },
      { name: "GET /api/users", url: "/api/users" },
      { name: "GET /api/stats", url: "/api/stats" },
      { name: "GET /api/health", url: "/api/health" },
      { name: "GET /api/courses", url: "/api/courses" },
      { name: "GET /api/batches", url: "/api/batches" },
      { name: "GET /api/ai/stats", url: "/api/ai/stats" },
      { name: "GET /api/settings/features", url: "/api/settings/features" },
      { name: "GET /api/certificates/user", url: "/api/certificates/user" },
      { name: "GET /api/courses/user/outline", url: "/api/courses/user/outline" },
    ];
    // Phase D: Parallelize health checks (was sequential — 10 × 200ms = 2s+)
    const results = await Promise.all(checks.map(async (c) => {
      const t0 = performance.now();
      try {
        const res = await fetch(c.url, { credentials: "include" });
        const ms = Math.round(performance.now() - t0);
        return { name: c.name, ok: res.ok, ms, error: res.ok ? undefined : `HTTP ${res.status}` } as { name: string; ok: boolean; ms: number; error?: string };
      } catch (e) {
        return { name: c.name, ok: false, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : "fetch failed" } as { name: string; ok: boolean; ms: number; error?: string };
      }
    }));
    setApiChecks(results);
    setChecking(false);
  };

  useEffect(() => { runChecks(); }, []);

  const runAlertCheck = async (dryRun: boolean) => {
    setAlertBusy(true);
    setAlertResult(null);
    try {
      const url = dryRun ? "/api/students/check-alerts?dryRun=true" : "/api/students/check-alerts";
      const res = await api.post<{
        studentsScanned: number; messagesCreated: number;
        messages: Array<{ type: string; toName: string; subject: string }>;
      }>(url, {});
      setAlertResult(res);
    } catch (e) {
      setAlertResult({
        studentsScanned: 0, messagesCreated: 0,
        messages: [{ type: "error", toName: "", subject: e instanceof Error ? e.message : "Failed" }],
      });
    } finally { setAlertBusy(false); }
  };

  const toggleFeature = async (key: string, value: boolean) => {
    setFeatureBusy(key);
    try {
      await api.post("/api/settings/features", { [key]: !value });
      setFeatures(prev => ({ ...prev, [key]: !value }));
    } catch { /* ignore */ }
    finally { setFeatureBusy(null); }
  };

  const okCount = apiChecks.filter(c => c.ok).length;
  const failCount = apiChecks.length - okCount;

  const envVars = [
    { key: "DATABASE_URL", set: health?.checks.db ?? false, hint: "Set in Vercel → Settings → Env Vars" },
    { key: "JWT_SECRET", set: health?.checks.jwt ?? false, hint: "openssl rand -hex 32" },
    { key: "DEEPSEEK_API_KEY", set: health?.checks.ai ?? false, hint: "platform.deepseek.com" },
    { key: "CRON_SECRET", set: false, hint: "Any random string for cron auth" },
    { key: "ADMIN_PASSWORD", set: false, hint: "Admin login password (dev default: helloworld)" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setActiveSubTab("overview")} variant={activeSubTab === "overview" ? "default" : "outline"} className={activeSubTab === "overview" ? "bg-primary text-primary-foreground" : "border-border"}>
          <Activity className="h-3.5 w-3.5" /> Overview
        </Button>
        <Button onClick={() => setActiveSubTab("ai")} variant={activeSubTab === "ai" ? "default" : "outline"} className={activeSubTab === "ai" ? "bg-primary text-primary-foreground" : "border-border"}>
          <Zap className="h-3.5 w-3.5" /> AI Management
        </Button>
        <Button onClick={() => setActiveSubTab("flags")} variant={activeSubTab === "flags" ? "default" : "outline"} className={activeSubTab === "flags" ? "bg-primary text-primary-foreground" : "border-border"}>
          <SettingsIcon className="h-3.5 w-3.5" /> Feature Flags
        </Button>
        <Button onClick={() => setActiveSubTab("actions")} variant={activeSubTab === "actions" ? "default" : "outline"} className={activeSubTab === "actions" ? "bg-primary text-primary-foreground" : "border-border"}>
          <Terminal className="h-3.5 w-3.5" /> Admin Actions
        </Button>
        <Button onClick={() => setActiveSubTab("audit")} variant={activeSubTab === "audit" ? "default" : "outline"} className={activeSubTab === "audit" ? "bg-primary text-primary-foreground" : "border-border"}>
          <ClipboardList className="h-3.5 w-3.5" /> Audit Log
        </Button>
        <Button onClick={() => setActiveSubTab("access")} variant={activeSubTab === "access" ? "default" : "outline"} className={activeSubTab === "access" ? "bg-primary text-primary-foreground" : "border-border"}>
          <ShieldCheck className="h-3.5 w-3.5" /> Access Grants
        </Button>
        <Button onClick={() => setActiveSubTab("navconfig")} variant={activeSubTab === "navconfig" ? "default" : "outline"} className={activeSubTab === "navconfig" ? "bg-primary text-primary-foreground" : "border-border"}>
          <LayoutDashboard className="h-3.5 w-3.5" /> Nav Config
        </Button>
        <Button onClick={() => setActiveSubTab("maintenance")} variant={activeSubTab === "maintenance" ? "default" : "outline"} className={activeSubTab === "maintenance" ? "bg-primary text-primary-foreground" : "border-border"}>
          <RefreshCw className="h-3.5 w-3.5" /> Maintenance
        </Button>
      </div>

      {/* ===== OVERVIEW SUB-TAB ===== */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          {/* System health summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className={health?.checks.db ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-3 w-3 rounded-full ${health?.checks.db ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="text-xs text-muted-foreground">Database</span>
                </div>
                <p className="text-sm font-bold text-foreground">{health?.checks.db ? "Connected" : "Down"}</p>
              </CardContent>
            </Card>
            <Card className={health?.checks.ai ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-3 w-3 rounded-full ${health?.checks.ai ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-xs text-muted-foreground">AI Provider</span>
                </div>
                <p className="text-sm font-bold text-foreground">{health?.checks.ai ? "Configured" : "Not set"}</p>
              </CardContent>
            </Card>
            <Card className={health?.checks.jwt ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-3 w-3 rounded-full ${health?.checks.jwt ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-xs text-muted-foreground">JWT Secret</span>
                </div>
                <p className="text-sm font-bold text-foreground">{health?.checks.jwt ? "Secure" : "Dev default"}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-3 w-3 rounded-full ${okCount > 0 && failCount === 0 ? "bg-emerald-500" : failCount > 0 ? "bg-amber-500" : "bg-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">API Health</span>
                </div>
                <p className="text-sm font-bold text-foreground">{okCount}/{apiChecks.length} OK</p>
              </CardContent>
            </Card>
          </div>

          {/* Environment variables status */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Environment Variables</CardTitle>
              <CardDescription className="text-muted-foreground">Status of critical env vars. Set these in Vercel → Settings → Environment Variables.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {envVars.map(v => (
                  <div key={v.key} className="flex items-center gap-3 rounded-md bg-muted p-2.5 text-sm">
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${v.set ? "bg-emerald-500" : "bg-red-500"}`} />
                    <code className="text-xs font-mono text-foreground flex-1">{v.key}</code>
                    {v.set ? (
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Set</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/30">Missing</Badge>
                    )}
                    {!v.set && <span className="text-[10px] text-muted-foreground">{v.hint}</span>}
                  </div>
                ))}
              </div>
              {(health && !health.checks.jwt) && (
                <p className="text-[10px] text-amber-600 mt-2">⚠ Set JWT_SECRET in Vercel env vars — the app currently uses an insecure dev default.</p>
              )}
              {(health && !health.checks.ai) && (
                <p className="text-[10px] text-amber-600 mt-1">⚠ Set DEEPSEEK_API_KEY — AI features (tests, tutor, course generation) won't work without it.</p>
              )}
            </CardContent>
          </Card>

          {/* Deployment info */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Deployment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted p-2.5">
                  <p className="text-[10px] text-muted-foreground">App Version</p>
                  <p className="text-sm font-mono text-foreground">{health?.version || "1.0.0"}</p>
                </div>
                <div className="rounded-md bg-muted p-2.5">
                  <p className="text-[10px] text-muted-foreground">System Status</p>
                  <p className={`text-sm font-bold ${health?.status === "ok" ? "text-emerald-600" : health?.status === "degraded" ? "text-amber-600" : "text-red-600"}`}>
                    {health?.status?.toUpperCase() || "Unknown"}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-2.5">
                  <p className="text-[10px] text-muted-foreground">Cron Schedule</p>
                  <p className="text-sm font-mono text-foreground">Daily 9:00 AM UTC</p>
                </div>
                <div className="rounded-md bg-muted p-2.5">
                  <p className="text-[10px] text-muted-foreground">Health Endpoint</p>
                  <a href="/api/health" target="_blank" className="text-xs text-primary hover:underline">/api/health →</a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API health check */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-foreground flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> API Health Check</CardTitle>
                  <CardDescription className="text-muted-foreground">{apiChecks.length === 0 ? "Running diagnostics..." : `${okCount} OK · ${failCount} failed`}</CardDescription>
                </div>
                <Button onClick={runChecks} disabled={checking} size="sm" variant="outline" className="border-border">
                  {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {apiChecks.map(c => (
                  <div key={c.name} className="flex items-center gap-3 rounded-md bg-muted p-2 text-sm">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> : <Bug className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    <span className="font-mono text-xs text-foreground/80 flex-1">{c.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${c.ms > 1000 ? "text-amber-600" : "text-muted-foreground"}`}>{c.ms}ms</Badge>
                    {c.error && <span className="text-xs text-red-500">{c.error}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* DB table counts */}
          {dbCounts && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base text-foreground flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Database Tables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(dbCounts).map(([table, count]) => (
                    <div key={table} className="rounded-md bg-muted p-2">
                      <p className="text-[10px] text-muted-foreground capitalize">{table}</p>
                      <p className="text-lg font-bold text-foreground">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent activity */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent User Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {users.slice(0, 8).map(u => (
                  <div key={u.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-xs">
                    <span className="text-foreground font-medium">{u.name}</span>
                    <span className="text-muted-foreground hidden sm:inline">{u.email}</span>
                    <Badge variant="outline" className={`text-[10px] capitalize ${u.blocked ? "text-red-500" : u.role === "admin" ? "text-primary" : ""}`}>{u.blocked ? "blocked" : u.role}</Badge>
                    <span className="text-muted-foreground text-[10px]">{u.lastLogin ? `${new Date(u.lastLogin).toLocaleDateString()}` : "never"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== AI MANAGEMENT SUB-TAB ===== */}
      {activeSubTab === "ai" && (
        <div className="space-y-4">
          <AIConnectionPanel />

          {aiStats && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base text-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> AI Token Stats</CardTitle>
                <CardDescription className="text-muted-foreground">Provider breakdown, cache hit rate, token usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Cache Hit Rate</p>
                    <p className="text-xl font-bold text-emerald-500">{aiStats.cache?.hitRate ?? 0}%</p>
                    <p className="text-[10px] text-muted-foreground">{aiStats.cache?.totalHits ?? 0} hits · {aiStats.cache?.totalMisses ?? 0} misses</p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Tokens (all-time)</p>
                    <p className="text-xl font-bold text-foreground">{(aiStats.tokens?.total ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{aiStats.tokens?.prompt ?? 0} prompt · {aiStats.tokens?.completion ?? 0} completion</p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Calls (24h)</p>
                    <p className="text-xl font-bold text-foreground">{aiStats.usage24h?.calls ?? 0}</p>
                    <p className="text-[10px] text-emerald-600">{aiStats.usage24h?.successRate ?? 100}% success</p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Behavioral Records</p>
                    <p className="text-xl font-bold text-violet-500">{aiStats.psychObsCount ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">PsychologyObs entries</p>
                  </div>
                </div>

                {aiStats.rateLimits && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Rate Limits (RPM)</p>
                      <p className="text-sm font-bold text-foreground">{aiStats.rateLimits.rpmUsed} / {aiStats.rateLimits.rpmLimit}</p>
                      <Progress value={(aiStats.rateLimits.rpmUsed / aiStats.rateLimits.rpmLimit) * 100} className="h-1 mt-1" />
                    </div>
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Daily Quota</p>
                      <p className="text-sm font-bold text-foreground">{aiStats.quota?.used ?? 0} / {aiStats.quota?.limit ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">{aiStats.quota?.percentUsed ?? 0}% used</p>
                    </div>
                  </div>
                )}

                {aiStats.providerBreakdown && Object.keys(aiStats.providerBreakdown).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Provider Breakdown</p>
                    <div className="space-y-1.5">
                      {Object.entries(aiStats.providerBreakdown).map(([provider, data]: [string, any]) => (
                        <div key={provider} className="flex items-center justify-between rounded-md bg-muted/60 p-2 text-xs">
                          <span className={provider === "deepseek" ? "text-emerald-600 font-medium" : provider === "z-ai" ? "text-amber-600 font-medium" : "text-red-500 font-medium"}>{provider}</span>
                          <span className="text-muted-foreground font-mono">{data.calls} calls · {data.tokens?.toLocaleString() ?? 0} tok</span>
                          <span className="text-emerald-600 text-[10px]">{data.calls > 0 ? Math.round((data.successes / data.calls) * 100) : 0}% ok</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiStats.featureBreakdown && Object.keys(aiStats.featureBreakdown).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Feature Breakdown</p>
                    <div className="space-y-1.5">
                      {Object.entries(aiStats.featureBreakdown).map(([feature, data]: [string, any]) => (
                        <div key={feature} className="flex items-center justify-between rounded-md bg-muted/60 p-2 text-xs">
                          <span className="text-foreground/80 font-mono">{feature}</span>
                          <span className="text-muted-foreground font-mono">{data.calls} calls · {data.tokens?.toLocaleString() ?? 0} tok</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiStats.recentErrors && aiStats.recentErrors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Recent AI Errors (last 5)
                    </p>
                    <div className="space-y-1">
                      {aiStats.recentErrors.map((err: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-2 text-xs">
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">{err.provider}</Badge>
                          <span className="font-mono text-muted-foreground">{err.feature}</span>
                          <span className="text-foreground/70 flex-1 truncate">{err.error}</span>
                          <span className="text-muted-foreground text-[10px]">{new Date(err.at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Struggle detection */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Struggle Detection</CardTitle>
              <CardDescription className="text-muted-foreground">Auto-scan for inactive + struggling students. Runs daily at 9 AM UTC via cron.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={() => runAlertCheck(true)} disabled={alertBusy} size="sm" variant="outline" className="border-border">
                  {alertBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Preview (dry run)
                </Button>
                <Button onClick={() => runAlertCheck(false)} disabled={alertBusy} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {alertBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Run &amp; Send Messages
                </Button>
              </div>
              {alertResult && (
                <div className="rounded-md border border-border bg-muted p-3 space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="text-[10px]">{alertResult.studentsScanned} scanned</Badge>
                    <Badge variant="outline" className={`text-[10px] ${alertResult.messagesCreated > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}`}>
                      {alertResult.messagesCreated} message{alertResult.messagesCreated === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {alertResult.messages.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {alertResult.messages.map((m, i) => (
                        <div key={i} className="text-xs rounded bg-background/50 p-2 border border-border">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className={`text-[9px] ${m.type === "teacher_alert" ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                              {m.type === "teacher_alert" ? "Teacher alert" : "Student nudge"}
                            </Badge>
                            <span className="text-foreground font-medium">{m.toName}</span>
                          </div>
                          <p className="text-muted-foreground">{m.subject}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {alertResult.messagesCreated === 0 && (
                    <p className="text-xs text-emerald-600">All students are on track — no alerts needed.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== FEATURE FLAGS SUB-TAB ===== */}
      {activeSubTab === "flags" && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-primary" /> Feature Flags</CardTitle>
            <CardDescription className="text-muted-foreground">Toggle app features on/off. Changes take effect immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            {features ? (
              <div className="space-y-2">
                {Object.entries(features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{key.replace(/_/g, " ").replace(/enabled/g, "").trim() || key}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{key}</p>
                    </div>
                    <button
                      onClick={() => toggleFeature(key, enabled)}
                      disabled={featureBusy === key}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
                    >
                      {featureBusy === key ? (
                        <Loader2 className="h-3 w-3 animate-spin text-foreground absolute left-1/2 -translate-x-1/2" />
                      ) : (
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Loading feature flags…</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== ADMIN ACTIONS SUB-TAB ===== */}
      {activeSubTab === "actions" && (
        <div className="space-y-4">
          {/* Admin credentials */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Admin Credentials</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-md bg-muted p-3 font-mono text-xs">
                <div className="text-muted-foreground">email: <span className="text-primary">admin@examiner.ai</span></div>
                <div className="text-muted-foreground">password: <span className="text-primary">set via ADMIN_PASSWORD env var</span></div>
              </div>
              <p className="text-muted-foreground text-xs">In dev, defaults to <code className="text-primary">helloworld</code>. In production, must be set via env var.</p>
            </CardContent>
          </Card>

          {/* Dev tools */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Dev Tools</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => window.location.href = "/api/seed"} size="sm" variant="outline" className="border-border">
                  <RefreshCw className="h-3 w-3" /> Reseed Database
                </Button>
                <a href="/api/health" target="_blank" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
                  <Activity className="h-3 w-3" /> Health Check API
                </a>
                <a href="/api/students/check-alerts" target="_blank" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
                  <Users className="h-3 w-3" /> Run Struggle Detection (GET)
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground">Reseed creates the admin account + default batch if missing. Safe to run repeatedly.</p>
            </CardContent>
          </Card>

          {/* DB user stats */}
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> User Statistics</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Total users</p><p className="text-lg font-bold text-foreground">{users.length}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Students</p><p className="text-lg font-bold text-primary">{users.filter(u => u.role === "student").length}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Teachers</p><p className="text-lg font-bold text-blue-500">{users.filter(u => u.role === "teacher").length}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Blocked</p><p className="text-lg font-bold text-red-500">{users.filter(u => u.blocked).length}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== AUDIT LOG SUB-TAB (Phase RBAC+AUDIT Phase 4) ===== */}
      {activeSubTab === "audit" && (<AuditLogPanel />)}

      {/* ===== ACCESS GRANTS SUB-TAB (Phase RBAC+AUDIT Phase 2) ===== */}
      {activeSubTab === "access" && (<AccessGrantsPanel />)}

      {/* ===== NAV CONFIG SUB-TAB (admin assigns nav items per role) ===== */}
      {activeSubTab === "navconfig" && (<RoleNavConfigPanel />)}

      {/* ===== MAINTENANCE SUB-TAB (cache stats + psych data cleanup) ===== */}
      {activeSubTab === "maintenance" && (
        <div className="space-y-4">
          {/* Cache Stats */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">AI Token Cache</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Response cache for cacheable AI calls (daily motivation, project summary)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={async () => {
                try {
                  const stats = await api.get<{ size: number; hits: number; misses: number; hitRate: number; estimatedTokensSaved: number }>("/api/admin/cache");
                  setCacheStats(stats);
                } catch { /* non-blocking */ }
              }} variant="outline" size="sm" className="text-xs">Refresh stats</Button>
              {cacheStats && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border border-border p-2"><p className="text-muted-foreground text-[10px]">Entries</p><p className="font-bold text-foreground">{cacheStats.size}</p></div>
                  <div className="rounded border border-border p-2"><p className="text-muted-foreground text-[10px]">Hit Rate</p><p className="font-bold text-emerald-500">{cacheStats.hitRate}%</p></div>
                  <div className="rounded border border-border p-2"><p className="text-muted-foreground text-[10px]">Tokens Saved</p><p className="font-bold text-primary">{cacheStats.estimatedTokensSaved}</p></div>
                </div>
              )}
              <Button onClick={async () => {
                try { await api.del("/api/admin/cache"); setCacheStats(null); } catch { /* non-blocking */ }
              }} variant="outline" size="sm" className="text-xs mt-2 text-destructive border-destructive/30">Clear cache</Button>
            </CardContent>
          </Card>

          {/* Psych Data Cleanup */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">Psychological Data Cleanup</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Remove old junk data from per-message pipeline (tutor snapshots, old PsychEvidence artifacts)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={async () => {
                try {
                  const preview = await api.get<{ wouldDelete: Record<string, number>; totalWouldDelete: number; kept: Record<string, number> }>("/api/admin/cleanup-psych-data");
                  setCleanupPreview(preview);
                } catch { /* non-blocking */ }
              }} variant="outline" size="sm" className="text-xs">Preview junk data</Button>
              {cleanupPreview && (
                <div className="mt-3 text-xs space-y-1">
                  <p className="font-medium text-foreground">Would delete: {cleanupPreview.totalWouldDelete} rows</p>
                  {Object.entries(cleanupPreview.wouldDelete).map(([k, v]) => v > 0 ? <p key={k} className="text-muted-foreground">{k}: {v}</p> : null)}
                  <p className="font-medium text-foreground mt-2">Would keep:</p>
                  {Object.entries(cleanupPreview.kept).map(([k, v]) => <p key={k} className="text-muted-foreground">{k}: {v}</p>)}
                </div>
              )}
              <Button onClick={async () => {
                try {
                  const result = await api.post<{ ok: boolean; deleted: Record<string, number>; totalDeleted: number }>("/api/admin/cleanup-psych-data", {});
                  alert(`Deleted ${result.totalDeleted} junk rows`);
                  setCleanupPreview(null);
                } catch { /* non-blocking */ }
              }} variant="outline" size="sm" className="text-xs mt-2 text-destructive border-destructive/30">Run cleanup</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
