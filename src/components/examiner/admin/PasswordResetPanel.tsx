"use client";

import { showError } from "@/lib/toast-helpers";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Input } from "@/modules/ui/input";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";
import type { ResetRequest } from "@/components/examiner/admin/types";

export function PasswordResetPanel() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tempPwInputs, setTempPwInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ requests: ResetRequest[] }>("/api/password-reset-requests?status=all");
      setRequests(res.requests || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    const tempPw = tempPwInputs[id] || `temp${Math.random().toString(36).slice(2, 8)}`;
    if (tempPw.length < 6) { showError("Temporary password must be at least 6 characters"); return; }
    setBusy(id);
    try {
      const res = await api.post<{ ok: boolean; tempPassword: string; message: string }>(`/api/password-reset-requests/${id}/approve`, { tempPassword: tempPw });
      setResult(`✓ ${res.message}`); setTempPwInputs({});
      await load(); setTimeout(() => setResult(null), 5000);
    } catch (e) { showError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const pendingReqs = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  return (
    <div className="space-y-4">
      {result && <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">{result}</div>}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Pending Reset Requests</CardTitle>
          <CardDescription className="text-muted-foreground">Students who forgot their password and don&apos;t have a security question set.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingReqs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No pending requests.</p> : (
            pendingReqs.map(r => (
              <div key={r.id} className="rounded-lg border border-border bg-background/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">{r.user.name}</p><p className="text-xs text-muted-foreground">{r.user.email} · requested {new Date(r.createdAt).toLocaleDateString()}</p></div>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground capitalize">{r.status}</Badge>
                </div>
                {r.reason && <p className="text-xs text-muted-foreground italic">&ldquo;{r.reason}&rdquo;</p>}
                <div className="flex gap-2 items-center">
                  <Input type="text" placeholder="Temp password (min 6 chars)" value={tempPwInputs[r.id] || ""} onChange={(e) => setTempPwInputs({ ...tempPwInputs, [r.id]: e.target.value })} className="bg-background border-border text-foreground text-sm h-8" />
                  <Button size="sm" onClick={() => approve(r.id)} disabled={busy === r.id} className="bg-primary hover:bg-primary/90 text-primary-foreground h-8">{busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve &amp; Reset</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {resolved.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base text-foreground">Resolved Requests ({resolved.length})</CardTitle></CardHeader>
          <CardContent><div className="space-y-2">
            {resolved.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-xs">
                <span className="text-foreground">{r.user.name} ({r.user.email})</span>
                <Badge variant="outline" className="capitalize">{r.status}</Badge>
                {/* HI-11 fix: temp password is no longer stored in plaintext —
                    the admin sees it only in the approve response, not here. */}
                {r.tempPassword && r.tempPassword !== "[SET — not stored for security]" && (
                  <span className="font-mono text-muted-foreground">temp: {r.tempPassword}</span>
                )}
                <span className="text-muted-foreground">{r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div></CardContent>
        </Card>
      )}
    </div>
  );
}
