"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";
import { LayoutDashboard } from "@/components/examiner/admin/LayoutDashboard";

export function RoleNavConfigPanel() {
  const [configs, setConfigs] = useState<Array<{ role: string; navItems: string[]; isCustom: boolean }>>([]);
  const [allNavKeys, setAllNavKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>("instructor");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const NAV_LABELS: Record<string, string> = {
    // Learner (4-view model)
    "dashboard": "Home (Learner Dashboard)",
    "checkin": "Study (Practice + Tests + Check-in)",
    "gantt": "Project (Gantt + Tasks)",
    "report-card": "Progress (Reports + Certificates)",
    // Instructor sub-tabs
    "batch": "Today (Instructor Dashboard)",
    "batch-students": "Students Roster",
    "batch-assignments": "Assignments",
    "batch-insights": "Insights",
    // Course planner
    "course-planner": "Course Planner",
    // Admin
    "admin-dashboard": "Admin Dashboard",
    "admin-users": "Users Management",
    "admin-courses": "Courses Management",
    "admin-features": "Feature Flags",
    "admin-resets": "Password Resets",
    "admin-system": "System & Dev",
    // Shared
    "ai-tutor": "AI Tutor (Learner Practice)",
    "instructor-ai-tutor": "Instructor AI Assistant",
    "course-outline": "Course Outline",
    "messages": "Messages",
    "settings": "Settings",
  };

  const ROLE_LABELS: Record<string, string> = {
    learner: "Learner",
    instructor: "Instructor / Mentor",
    org_admin: "Org Admin",
    platform_admin: "Platform Admin",
    demo: "Demo (read-only)",
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ configs: Array<{ role: string; navItems: string[]; isCustom: boolean }>; allNavKeys: string[] }>("/api/role-nav-config");
      setConfigs(res.configs || []);
      setAllNavKeys(res.allNavKeys || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleNavKey = (key: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.role !== selectedRole) return c;
      const has = c.navItems.includes(key);
      return {
        ...c,
        navItems: has ? c.navItems.filter(k => k !== key) : [...c.navItems, key],
        isCustom: true,
      };
    }));
  };

  const save = async () => {
    const config = configs.find(c => c.role === selectedRole);
    if (!config) return;
    setSaving(true); setMsg("");
    try {
      await api.post("/api/role-nav-config", { role: selectedRole, navItems: config.navItems });
      setMsg("Saved! Changes take effect on next page load.");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Failed to save");
    } finally { setSaving(false); }
  };

  const resetRole = async () => {
    if (!confirm(`Reset ${ROLE_LABELS[selectedRole]} to default navigation?`)) return;
    try {
      await api.del("/api/role-nav-config", { role: selectedRole });
      await load();
      setMsg("Reset to defaults.");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("Failed to reset"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const currentConfig = configs.find(c => c.role === selectedRole);

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-primary" /> Role Navigation Config
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Assign which tabs each role sees in their sidebar. Changes take effect on next page load.
            Use the dropdown to switch between roles and preview their interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-xs text-muted-foreground">Editing navigation for:</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="bg-muted border-border w-56 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([key, label]) => {
                  const config = configs.find(c => c.role === key);
                  return (
                    <SelectItem key={key} value={key}>
                      {label}{config?.isCustom ? " (custom)" : " (default)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentConfig?.isCustom && (
              <Button onClick={resetRole} size="sm" variant="outline" className="border-border text-xs">
                Reset to default
              </Button>
            )}
          </div>

          {/* Nav items checklist */}
          <div className="rounded-md border border-border p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground mb-2">Available tabs (check the ones this role should see):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {allNavKeys.map(key => {
                const isEnabled = currentConfig?.navItems.includes(key) ?? false;
                return (
                  <label key={key} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleNavKey(key)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className={`text-xs ${isEnabled ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {NAV_LABELS[key] || key}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Preview: what this role will see */}
          <div className="rounded-md bg-muted/30 border border-border p-3">
            <p className="text-xs font-medium text-foreground mb-2">Preview — {ROLE_LABELS[selectedRole]} sees these tabs:</p>
            <div className="flex flex-wrap gap-1">
              {currentConfig?.navItems.map(key => (
                <Badge key={key} variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                  {NAV_LABELS[key] || key}
                </Badge>
              ))}
              {(!currentConfig || currentConfig.navItems.length === 0) && (
                <span className="text-xs text-muted-foreground italic">No tabs assigned — this role will see an empty sidebar</span>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save navigation for {ROLE_LABELS[selectedRole]}
            </Button>
            {msg && <span className={`text-xs ${msg.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Quick presets */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm text-foreground">Quick Presets</CardTitle>
          <CardDescription className="text-muted-foreground">Click a preset to apply recommended navigation for that role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { role: "org_admin", label: "Org Admin — Operational oversight", items: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-system", "course-outline", "messages", "settings"], desc: "Full organizational control: users, courses, feature flags, system health, audit log." },
          ].map(preset => (
            <div key={preset.role} className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{preset.label}</p>
                <p className="text-[10px] text-muted-foreground">{preset.desc}</p>
              </div>
              <Button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await api.post("/api/role-nav-config", { role: preset.role, navItems: preset.items });
                    await load();
                    setSelectedRole(preset.role);
                    setMsg(`Preset applied for ${ROLE_LABELS[preset.role]}`);
                    setTimeout(() => setMsg(""), 3000);
                  } catch { setMsg("Failed"); }
                  finally { setSaving(false); }
                }}
                size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10 text-xs flex-shrink-0"
              >
                Apply
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
