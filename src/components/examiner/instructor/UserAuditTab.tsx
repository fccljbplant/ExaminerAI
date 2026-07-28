"use client";

/**
 * UserAuditTab — comprehensive audit trail for any user.
 *
 * Shows:
 *   1. Activity summary cards (mentorship, alerts, crisis, tests, AI usage)
 *   2. AI usage breakdown (last 30 days, by feature)
 *   3. Full audit log (actions BY + ABOUT this user), paginated
 *
 * Visible to: principal + administrator (full oversight)
 * Also visible to: the user themselves (self-audit) + teachers (for their
 * course students) + counselors (for their caseload)
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ShieldCheck, Bot, AlertTriangle, HeartHandshake, FileText,
  Activity, ChevronLeft, ChevronRight, Brain, Clock, User, Target,
} from "lucide-react";

interface AuditEntry {
  id: string;
  actorName: string;
  actorRole: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: any;
  after: any;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
  direction: "by" | "about";
}

interface AuditResponse {
  user: { id: string; name: string; email: string; role: string; createdAt: string };
  auditLogs: AuditEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  aiUsage: {
    last30Days: Record<string, { total: number; success: number; failed: number; tokens: number }>;
    totalCalls: number;
    todayCount: number;
    recent: Array<{ feature: string; provider: string; success: boolean; tokens: number; createdAt: string }>;
  };
  activity: {
    mentorshipTouchpoints: number;
    alerts: number;
    crisisFlags: number;
    completedTests: number;
  };
  permissions: { canViewFullAudit: boolean; isViewingSelf: boolean };
}

// Human-readable labels for audit actions
const ACTION_LABELS: Record<string, string> = {
  role_assigned: "Role changed",
  user_approved: "User approved",
  user_blocked: "User blocked",
  user_deleted: "User deleted",
  user_created: "User created",
  access_grant_created: "Access grant created",
  access_grant_revoked: "Access grant revoked",
  grade_changed: "Grade changed",
  retake_allowed: "Retake allowed",
  test_unlocked: "Test unlocked",
  course_content_edited: "Course content edited",
  course_created: "Course created",
  course_deleted: "Course deleted",
  escalation_config_changed: "Escalation config changed",
  feature_flag_toggled: "Feature flag toggled",
  crisis_flag_viewed: "Crisis flag viewed",
  wellbeing_alert_viewed: "Wellbeing alert viewed",
  // Additional actions logged by the system
  user_logged_in: "Logged in",
  ai_limit_reached: "AI rate limit reached",
  demo_ai_toggled: "Demo AI toggled",
  ai_limits_changed: "AI limits changed",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function roleColor(role: string): string {
  const colors: Record<string, string> = {
    student: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
    teacher: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    counselor: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
    guardian: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30",
    principal: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
    administrator: "text-slate-600 bg-slate-100 dark:bg-slate-800/50",
    demo: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  };
  return colors[role] || "text-muted-foreground bg-muted";
}

export function UserAuditTab({ userId }: { userId: string }) {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<"all" | "by" | "about">("all");

  const load = useCallback(async (pageNum?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum ?? page));
      params.set("pageSize", "25");
      params.set("direction", direction);
      const res = await api.get<AuditResponse>(`/api/users/${userId}/audit?${params.toString()}`);
      setData(res);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, page, direction]);

  useEffect(() => { load(1); }, [direction]);  
  useEffect(() => { load(); }, [page]);  

  if (loading && !data) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (!data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to load audit trail.</p>
          <Button onClick={() => load()} variant="outline" size="sm" className="mt-3">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { user, auditLogs, pagination, aiUsage, activity, permissions } = data;

  return (
    <div className="space-y-4">
      {/* Permission notice */}
      {!permissions.canViewFullAudit && !permissions.isViewingSelf && (
        <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            You're viewing this user's audit trail based on your course access. Principals and administrators can view the full audit trail for any user.
          </p>
        </div>
      )}

      {/* Activity summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <FileText className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{activity.completedTests}</div>
            <div className="text-[10px] text-muted-foreground">Tests</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <HeartHandshake className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{activity.mentorshipTouchpoints}</div>
            <div className="text-[10px] text-muted-foreground">Mentor Sessions</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{activity.alerts}</div>
            <div className="text-[10px] text-muted-foreground">Alerts</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <ShieldCheck className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{activity.crisisFlags}</div>
            <div className="text-[10px] text-muted-foreground">Crisis Flags</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <Bot className="w-4 h-4 text-fuchsia-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{aiUsage.totalCalls}</div>
            <div className="text-[10px] text-muted-foreground">AI Calls (30d)</div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <Clock className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{aiUsage.todayCount}</div>
            <div className="text-[10px] text-muted-foreground">AI Today</div>
          </CardContent>
        </Card>
      </div>

      {/* AI usage breakdown */}
      {permissions.canViewFullAudit && Object.keys(aiUsage.last30Days).length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> AI Usage Breakdown (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(aiUsage.last30Days)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([feature, stats]) => (
                  <div key={feature} className="p-2 rounded-md border border-border bg-background">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{feature}</span>
                      <Badge variant="outline" className="text-[9px]">{stats.total}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="text-emerald-600">{stats.success} ok</span>
                      {stats.failed > 0 && <span className="text-rose-600">{stats.failed} failed</span>}
                      <span>· {stats.tokens.toLocaleString()} tokens</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full audit log */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                All actions by and about {user.name} ({pagination.total} total)
              </CardDescription>
            </div>
            {/* Direction filter */}
            <div className="flex gap-1">
              {(["all", "by", "about"] as const).map(d => (
                <Button
                  key={d}
                  onClick={() => { setDirection(d); setPage(1); }}
                  size="sm"
                  variant={direction === d ? "default" : "outline"}
                  className={`h-7 text-xs ${direction === d ? "bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {d === "all" ? "All" : d === "by" ? "By user" : "About user"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No audit entries found.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {auditLogs.map(log => (
                <div key={log.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Direction indicator */}
                      {log.direction === "by" ? (
                        <User className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Target className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground">{log.actorName}</span>
                      <Badge variant="outline" className={`text-[9px] ${roleColor(log.actorRole)}`}>
                        {log.actorRole}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{actionLabel(log.action)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {/* Before/after details for relevant actions */}
                  {(log.before || log.after) && (
                    <div className="mt-1 ml-5 text-[10px] text-muted-foreground flex items-center gap-3">
                      {log.before && (
                        <span>Before: <code className="bg-muted px-1 rounded">{JSON.stringify(log.before)}</code></span>
                      )}
                      {log.after && (
                        <span>After: <code className="bg-muted px-1 rounded">{JSON.stringify(log.after)}</code></span>
                      )}
                    </div>
                  )}
                  {/* Metadata */}
                  {log.metadata && (
                    <div className="mt-1 ml-5 text-[10px] text-muted-foreground">
                      {Object.entries(log.metadata).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: <code className="bg-muted px-1 rounded">{String(v)}</code></span>
                      ))}
                    </div>
                  )}
                  {/* IP address */}
                  {log.ipAddress && permissions.canViewFullAudit && (
                    <div className="mt-1 ml-5 text-[10px] text-muted-foreground">
                      IP: <code className="bg-muted px-1 rounded">{log.ipAddress}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || loading}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 border-border"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 border-border"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent AI calls (privileged only) */}
      {permissions.canViewFullAudit && aiUsage.recent.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Recent AI Calls
            </CardTitle>
            <CardDescription className="text-xs">Last {aiUsage.recent.length} AI interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {aiUsage.recent.map((call, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${call.success ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="text-foreground">{call.feature}</span>
                    <Badge variant="outline" className="text-[9px]">{call.provider}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{call.tokens} tokens</span>
                    <span>{new Date(call.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
