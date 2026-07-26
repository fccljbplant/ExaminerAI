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

export function AccessGrantsPanel() {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await api.get<{ grants: any[] }>("/api/access-grants");
      setGrants(res.grants);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load access grants"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dataScopeLabel = (scope: string): { label: string; color: string } => {
    switch (scope) {
      case "full": return { label: "Full access", color: "bg-red-500/10 text-red-600 border-red-500/30" };
      case "wellbeing_only": return { label: "Wellbeing only", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
      case "crisis_only": return { label: "Crisis only", color: "bg-red-500/10 text-red-600 border-red-500/30" };
      case "content_only": return { label: "Content only", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
      default: return { label: scope, color: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Access Grants</CardTitle>
          <CardDescription className="text-muted-foreground">
            Scoped least-privilege access. Counselors with no explicit grant see nothing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-sm text-red-600 text-center py-4">{error}</div>
          ) : grants.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No active access grants yet. Grants allow counselors to access specific students'
              wellbeing data. Ask an administrator to create one when needed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 px-2 font-medium">Grantee</th>
                    <th className="text-left py-2 px-2 font-medium">Scope</th>
                    <th className="text-left py-2 px-2 font-medium">Data scope</th>
                    <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g: any) => {
                    const scope = dataScopeLabel(g.dataScope);
                    return (
                      <tr key={g.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 px-2">
                          <div className="text-xs font-medium text-foreground">{g.grantee?.name ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{g.grantee?.email}</div>
                          <div className="text-[10px] text-muted-foreground">{g.grantee?.role}</div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="text-xs text-foreground">{g.scopeType}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{g.scopeId.slice(0, 12)}…</div>
                        </td>
                        <td className="py-2 px-2"><Badge variant="outline" className={`text-[9px] ${scope.color}`}>{scope.label}</Badge></td>
                        <td className="py-2 px-2 text-xs text-muted-foreground hidden md:table-cell">{new Date(g.grantedAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-sm text-foreground">About Access Grants</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• A role defines <em>what kind</em> of access is possible. An AccessGrant defines <em>whose data</em> a user actually sees.</p>
          <p>• A counselor with no explicit grant rows sees nothing.</p>
          <p>• Scope types: <code className="text-primary">batch</code> | <code className="text-primary">student</code> | <code className="text-primary">course</code> | <code className="text-primary">institution</code></p>
          <p>• Data scopes: <code className="text-primary">full</code> | <code className="text-primary">wellbeing_only</code> | <code className="text-primary">crisis_only</code> | <code className="text-primary">content_only</code></p>
        </CardContent>
      </Card>
    </div>
  );
}
