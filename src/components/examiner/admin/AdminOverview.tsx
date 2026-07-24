"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";
import type { UserRow } from "@/components/examiner/admin/types";
import { OverviewStat } from "@/components/examiner/admin/OverviewStat";
import { QuickAction } from "@/components/examiner/admin/QuickAction";

export function AdminOverview({ users, pending, students, teachers, blocked, onTab }: {
  users: UserRow[]; pending: UserRow[]; students: UserRow[]; teachers: UserRow[]; blocked: UserRow[];
  onTab: (t: "overview" | "users" | "features" | "resets" | "system") => void;
}) {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <OverviewStat label="Total Users" value={users.length} icon={<Users className="h-4 w-4" />} color="text-primary" />
        <OverviewStat label="Students" value={students.length} icon={<UserCheck className="h-4 w-4" />} color="text-emerald-500" />
        <OverviewStat label="Pending" value={pending.length} icon={<Clock className="h-4 w-4" />} color="text-amber-500" />
        <OverviewStat label="Teachers" value={teachers.length} icon={<Users className="h-4 w-4" />} color="text-blue-500" />
        <OverviewStat label="Blocked" value={blocked.length} icon={<Ban className="h-4 w-4" />} color="text-red-500" />
      </div>

      {/* Pending approvals — quick action */}
      {pending.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Pending Approvals ({pending.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground">Students waiting for approval — teachers can also approve these</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-md bg-amber-500/10 p-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <Button onClick={() => onTab("users")} size="sm" variant="outline" className="border-amber-500/30 text-amber-600">
                  Go to Users →
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickAction label="User Management" desc="Approve, block, delete, change roles" icon={Users} onClick={() => onTab("users")} />
        <QuickAction label="Features Control" desc="Enable/disable app features" icon={SettingsIcon} onClick={() => onTab("features")} />
        <QuickAction label="System & Dev" desc="AI test, health checks, DB status" icon={Server} onClick={() => onTab("system")} />
      </div>

      {/* Recent signups */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Recent Signups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {users.slice(0, 8).map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-md bg-muted p-2 text-xs">
                <span className="text-foreground font-medium">{u.name}</span>
                <span className="text-muted-foreground">{u.email}</span>
                <Badge variant="outline" className={`text-[10px] capitalize ${u.blocked ? "text-red-500" : u.role === "pending" ? "text-amber-500" : ""}`}>
                  {u.blocked ? "blocked" : u.role}
                </Badge>
                <span className="text-muted-foreground">{u.lastLogin ? `last seen ${new Date(u.lastLogin).toLocaleDateString()}` : "never logged in"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
