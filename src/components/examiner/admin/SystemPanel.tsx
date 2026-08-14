"use client";
// src/components/examiner/admin/SystemPanel.tsx — SIMPLIFIED.
//
// This panel used to have 8 sub-tabs (overview, ai, flags, actions, audit,
// access, navconfig, maintenance). The useful panels have been PROMOTED
// to top-level admin tabs:
//   - AI Connection    → top-level "AI Connection" tab
//   - Audit Log        → top-level "Audit Log" tab
//   - Access Grants    → top-level "Access Grants" tab
//   - Nav Config       → top-level "Nav Config" tab
//   - Maintenance      → top-level "Maintenance" tab (MaintenancePanel)
//
// What remains here is the DEV-ONLY stuff:
//   - System health check (DB, AI, JWT env vars)
//   - API endpoint checker
//   - Admin credentials reference
//   - Reseed database (destructive, requires typing RESET)
//   - User statistics summary
//
// Admin-only. Not visible to demo accounts.

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Database, Key, Terminal,
  CheckCircle2, Zap, AlertTriangle, Activity, Server, Send,
  ShieldCheck,
} from "lucide-react";
import type { UserRow } from "@/components/examiner/admin/types";

interface ApiCheck { name: string; ok: boolean; ms: number; error?: string }
interface Health { status: string; checks: { db: boolean; ai: boolean; jwt: boolean }; version: string }

export function SystemPanel({ users }: { users: UserRow[] }) {
  const [apiChecks, setApiChecks] = useState<ApiCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [reseedOpen, setReseedOpen] = useState(false);
  const [reseedConfirm, setReseedConfirm] = useState("");
  const [reseedBusy, setReseedBusy] = useState(false);

  const canConfirmReseed = reseedConfirm.trim().toUpperCase() === "RESET";

  const runReseed = async () => {
    if (!canConfirmReseed) return;
    setReseedBusy(true);
    try {
      await api.get("/api/seed");
      toast.success("Database reseeded.");
      setReseedOpen(false);
      setReseedConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reseed database");
    } finally {
      setReseedBusy(false);
    }
  };

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.get<Health>("/api/health");
      setHealth(data);
    } catch { /* ignore */ }
  }, []);

  const runApiChecks = async () => {
    setChecking(true);
    const checks: ApiCheck[] = [];
    const endpoints = [
      { name: "Health", url: "/api/health" },
      { name: "Auth (me)", url: "/api/auth/me" },
      { name: "Users list", url: "/api/users?pageSize=1" },
      { name: "Courses", url: "/api/courses" },
      { name: "AI stats", url: "/api/ai/stats" },
      { name: "Feature flags", url: "/api/settings/features" },
    ];
    for (const ep of endpoints) {
      const start = Date.now();
      try {
        await api.get(ep.url);
        checks.push({ name: ep.name, ok: true, ms: Date.now() - start });
      } catch (e) {
        checks.push({ name: ep.name, ok: false, ms: Date.now() - start, error: e instanceof Error ? e.message : "failed" });
      }
    }
    setApiChecks(checks);
    setChecking(false);
  };

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const envVars = [
    { key: "DATABASE_URL", set: health?.checks.db ?? false, hint: "Set in Vercel → Settings → Env Vars" },
    { key: "JWT_SECRET", set: health?.checks.jwt ?? false, hint: "openssl rand -hex 32" },
    { key: "DEEPSEEK_API_KEY", set: health?.checks.ai ?? false, hint: "platform.deepseek.com" },
    { key: "CRON_SECRET", set: false, hint: "Any random string for cron auth" },
    { key: "ADMIN_PASSWORD", set: false, hint: "Admin login password (dev default: helloworld)" },
  ];

  return (
    <div className="space-y-4">
      {/* ── System Health ─────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> System Health
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Environment variables, API endpoint checker, and DB connectivity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Env var status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Environment Variables</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {envVars.map((v) => (
                <div key={v.key} className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2">
                  <div>
                    <code className="text-xs text-foreground">{v.key}</code>
                    <p className="text-[10px] text-muted-foreground">{v.hint}</p>
                  </div>
                  {v.set
                    ? <Badge variant="outline" className="text-growth-sage border-growth-sage">Set</Badge>
                    : <Badge variant="outline" className="text-growth-amber-foreground border-growth-amber">Not set</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* API endpoint checker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">API Endpoint Checker</p>
              <Button onClick={runApiChecks} size="sm" variant="outline" disabled={checking}>
                {checking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                Run checks
              </Button>
            </div>
            {apiChecks.length > 0 && (
              <div className="space-y-1">
                {apiChecks.map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2 text-xs">
                    <span className="text-foreground">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">{c.ms}ms</span>
                      {c.ok
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-growth-sage" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Admin Credentials + Dev Tools ────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" /> Dev Tools
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Reseed database, health check API, struggle detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setReseedOpen(true)} size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5">
              <RefreshCw className="h-3 w-3 mr-1" /> Reseed Database
            </Button>
            <a href="/api/health" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
              <Activity className="h-3 w-3" /> Health Check API
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Reseed creates the admin account + default batch if missing. Safe to run repeatedly.
          </p>

          {/* Reseed confirmation dialog */}
          <AlertDialog open={reseedOpen} onOpenChange={(open) => {
            setReseedOpen(open);
            if (!open) { setReseedConfirm(""); setReseedBusy(false); }
          }}>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Reseed Database
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will DELETE ALL DATA and recreate demo data. This action cannot be undone. Type <strong className="font-mono text-foreground">RESET</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2">
                <Label htmlFor="reseed-confirm" className="text-xs text-muted-foreground">
                  Confirmation code
                </Label>
                <Input
                  id="reseed-confirm"
                  value={reseedConfirm}
                  onChange={(e) => setReseedConfirm(e.target.value)}
                  placeholder="Type RESET"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={reseedBusy}
                  className="font-mono"
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={reseedBusy}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void runReseed();
                  }}
                  disabled={!canConfirmReseed || reseedBusy}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {reseedBusy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>
                  ) : (
                    "Confirm Reset"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* ── User Statistics ──────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> User Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">Total users</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{users.length}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-lg font-bold text-primary tabular-nums">{users.filter(u => u.role === "student" || u.role === "learner").length}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">Teachers</p>
              <p className="text-lg font-bold text-primary tabular-nums">{users.filter(u => u.role === "instructor").length}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">Blocked</p>
              <p className="text-lg font-bold text-destructive tabular-nums">{users.filter(u => u.blocked).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
