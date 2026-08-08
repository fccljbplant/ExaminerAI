"use client";

import type { AuditLogEntry } from "@/lib/api-types";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";

export function AuditLogPanel() {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (actionFilter !== "all") params.set("action", actionFilter);
      const res = await api.get<{ entries: AuditLogEntry[]; total: number }>(`/api/audit-log?${params.toString()}`);
      setEntries(res.entries); setTotal(res.total);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load audit log"); }
    finally { setLoading(false); }
  }, [actionFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const actionLabel = (action: string): { label: string; color: string } => {
    if (action === "grade_changed") return { label: "Grade Override", color: "bg-growth-amber-soft text-growth-amber border-growth-amber" };
    if (action === "role_assigned") return { label: "Role Change", color: "bg-destructive/5 text-destructive border-destructive/30" };
    if (action === "user_approved") return { label: "User Approved", color: "bg-growth-sage-soft text-growth-sage border-growth-sage" };
    if (action === "user_blocked") return { label: "User Blocked", color: "bg-destructive/5 text-destructive border-destructive/30" };
    if (action === "user_created") return { label: "User Created", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
    if (action === "access_grant_created") return { label: "Access Grant", color: "bg-violet-500/10 text-violet-600 border-violet-500/30" };
    if (action === "crisis_flag_viewed" || action === "wellbeing_alert_viewed") return { label: "Sensitive View", color: "bg-destructive/5 text-destructive border-destructive/30" };
    return { label: action, color: "bg-muted text-muted-foreground" };
  };

  const renderChange = (entry: AuditLogEntry): React.ReactNode => {
    const before = entry.before; const after = entry.after;
    if (!before && !after) return <span className="text-muted-foreground">—</span>;
    if (entry.action === "grade_changed" && (before as { score?: number })?.score !== undefined) {
      return (
        <div className="text-xs">
          <span className="text-muted-foreground">Score: </span>
          <span className="text-destructive line-through">{(before as { score?: number }).score}%</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-growth-sage font-bold">{(after as { score?: number })?.score ?? "?"}%</span>
        </div>
      );
    }
    if (entry.action === "role_assigned") {
      return (
        <div className="text-xs">
          <span className="text-muted-foreground">Role: </span>
          <span className="text-destructive">{(before as { role?: string })?.role ?? "?"}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-growth-sage font-bold">{(after as { role?: string })?.role ?? "?"}</span>
        </div>
      );
    }
    return <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify({ before, after }, null, 2)}</pre>;
  };

  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Audit Log</CardTitle>
              <CardDescription className="text-muted-foreground">
                Append-only record of sensitive actions.{total > 0 && <span> · {total} total entries</span>}
              </CardDescription>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setOffset(0); }}>
              <SelectTrigger className="bg-muted border-border w-[180px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="grade_changed">Grade overrides</SelectItem>
                <SelectItem value="role_assigned">Role changes</SelectItem>
                <SelectItem value="user_approved">User approvals</SelectItem>
                <SelectItem value="user_blocked">User blocks</SelectItem>
                <SelectItem value="user_created">User creations</SelectItem>
                <SelectItem value="access_grant_created">Access grants</SelectItem>
                <SelectItem value="crisis_flag_viewed">Crisis flag views</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-sm text-destructive text-center py-4">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No audit entries yet. Grade overrides, role changes, and access grants will appear here.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="text-left py-2 px-2 font-medium">When</th>
                      <th className="text-left py-2 px-2 font-medium">Who</th>
                      <th className="text-left py-2 px-2 font-medium">Action</th>
                      <th className="text-left py-2 px-2 font-medium">Change</th>
                      <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Reason</th>
                      <th className="text-left py-2 px-2 font-medium hidden lg:table-cell">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e: AuditLogEntry) => {
                      const lbl = actionLabel(e.action);
                      const when = new Date(e.createdAt);
                      const minsAgo = Math.floor((Date.now() - when.getTime()) / 60000);
                      const whenLabel = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.floor(minsAgo / 60)}h ago` : `${Math.floor(minsAgo / 1440)}d ago`;
                      const metadataObj = e.metadata ? JSON.parse(e.metadata) as Record<string, unknown> : null;
                      const reason = metadataObj?.reason as string | undefined;
                      return (
                        <tr key={e.id} className="border-b border-border hover:bg-muted/30 align-top">
                          <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap" title={when.toLocaleString()}>{whenLabel}</td>
                          <td className="py-2 px-2">
                            <div className="text-xs font-medium text-foreground">{e.actorName}</div>
                            <div className="text-[10px] text-muted-foreground">{e.actorRole}</div>
                          </td>
                          <td className="py-2 px-2"><Badge variant="outline" className={`text-[9px] ${lbl.color}`}>{lbl.label}</Badge></td>
                          <td className="py-2 px-2 max-w-[300px]">{renderChange(e)}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground hidden md:table-cell max-w-[200px]">{reason ? <span className="italic">"{reason}"</span> : <span className="text-muted-foreground/60">—</span>}</td>
                          <td className="py-2 px-2 text-[10px] text-muted-foreground hidden lg:table-cell font-mono">{e.ipAddress ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-muted-foreground">Page {currentPage} of {pages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="border-border h-7">Previous</Button>
                    <Button size="sm" variant="outline" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} className="border-border h-7">Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-sm text-foreground">About the Audit Log</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• Every grade override, role change, and access grant is recorded with who/what/when/where/why.</p>
          <p>• The log is append-only — entries cannot be edited or deleted through the UI.</p>
          <p>• Staff (teachers/counselors/coordinators) can view only their own actions; admins see all entries.</p>
          <p>• Sensitive crisis/wellbeing data views are logged without duplicating the sensitive content itself.</p>
        </CardContent>
      </Card>
    </div>
  );
}
