"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import { Badge } from "@/modules/ui/badge";
import { showError, showSuccess } from "@/lib/toast-helpers";
import { logger } from "@/lib/logger";
import {
  Loader2, Gauge, Bot, MessageCircle, FileText, ShieldCheck, Save, AlertTriangle,
} from "lucide-react";

interface AIConfig {
  ai_test_daily_limit: number;
  ai_tutor_daily_limit: number;
  ai_assistant_daily_limit: number;
  demo_ai_enabled: boolean;
}

const DEFAULTS: AIConfig = {
  ai_test_daily_limit: 50,
  ai_tutor_daily_limit: 150,
  ai_assistant_daily_limit: 100,
  demo_ai_enabled: true,
};

export function AILimitsPanel() {
  const [config, setConfig] = useState<AIConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoToggleSaving, setDemoToggleSaving] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // Fetch current user's role — demo only sees the demo-AI toggle, not the
  // rate-limit inputs (those are admin-only configuration).
  useEffect(() => {
    api.get<{ user: { role: string } | null }>("/api/auth/me").then(res => {
      if (res.user?.role) setCurrentUserRole(res.user.role);
    }).catch((err) => { logger.warn("Operation failed", { err }); });
  }, []);

  const isDemo = currentUserRole === "demo";
  const canEditLimits = !isDemo; // only non-demo roles can view/edit the rate limits

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Demo gets a 403 from this endpoint — fall back to defaults silently.
      const res = await api.get<{ config: AIConfig }>("/api/settings/ai-limits").catch(() => ({ config: DEFAULTS }));
      setConfig({ ...DEFAULTS, ...res.config });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/api/settings/ai-limits", {
        ai_test_daily_limit: config.ai_test_daily_limit,
        ai_tutor_daily_limit: config.ai_tutor_daily_limit,
        ai_assistant_daily_limit: config.ai_assistant_daily_limit,
      });
      showSuccess("AI rate limits updated");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const toggleDemoAI = async () => {
    setDemoToggleSaving(true);
    try {
      await api.post("/api/settings/ai-limits", { demo_ai_enabled: !config.demo_ai_enabled });
      setConfig({ ...config, demo_ai_enabled: !config.demo_ai_enabled });
      showSuccess(`Demo AI ${!config.demo_ai_enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to toggle");
    } finally { setDemoToggleSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Demo-only notice */}
      {isDemo && (
        <div className="p-4 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Demo Account Settings</p>
            <p className="text-xs text-muted-foreground mt-1">
              As a demo account, you can only toggle your own AI access. Rate-limit configuration and other admin settings are hidden from demo accounts.
            </p>
          </div>
        </div>
      )}

      {/* Per-user daily AI rate limits — admin/principal only, NOT demo */}
      {canEditLimits && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Per-User Daily AI Rate Limits
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Maximum AI messages per user per day (UTC). Resets at 00:00 UTC. Set to 0 to disable a category.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-limit" className="text-xs flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-growth-amber" /> AI Test messages
                </Label>
                <Input
                  id="test-limit"
                  type="number"
                  min={0}
                  max={10000}
                  value={config.ai_test_daily_limit}
                  onChange={(e) => setConfig({ ...config, ai_test_daily_limit: parseInt(e.target.value, 10) || 0 })}
                  className="bg-background border-border"
                />
                <p className="text-[10px] text-muted-foreground">Practice + Daily + Weekly tests</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tutor-limit" className="text-xs flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-600" /> AI Tutor messages
                </Label>
                <Input
                  id="tutor-limit"
                  type="number"
                  min={0}
                  max={10000}
                  value={config.ai_tutor_daily_limit}
                  onChange={(e) => setConfig({ ...config, ai_tutor_daily_limit: parseInt(e.target.value, 10) || 0 })}
                  className="bg-background border-border"
                />
                <p className="text-[10px] text-muted-foreground">Student-facing AI Tutor chat</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assistant-limit" className="text-xs flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-growth-sage" /> AI Assistant messages
                </Label>
                <Input
                  id="assistant-limit"
                  type="number"
                  min={0}
                  max={10000}
                  value={config.ai_assistant_daily_limit}
                  onChange={(e) => setConfig({ ...config, ai_assistant_daily_limit: parseInt(e.target.value, 10) || 0 })}
                  className="bg-background border-border"
                />
                <p className="text-[10px] text-muted-foreground">Staff-facing AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Defaults: 50 test · 150 tutor · 100 assistant per user per day
              </div>
              <Button onClick={save} disabled={saving} size="sm" className="bg-primary text-primary-foreground">
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save limits
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demo AI enable/disable — visible to admin/principal AND demo
          (demo can see its own toggle status, but only admin can change it.
           Actually per the user's request, this is the ONE setting demo
           can interact with — but the API will reject demo's POST). */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Demo Account AI Access
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Control whether the demo account (<code className="bg-muted px-1 rounded text-xs">demo@examiner.ai</code>) can use any AI features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border bg-background p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                Demo AI Access
                {config.demo_ai_enabled ? (
                  <Badge variant="outline" className="text-[10px] text-growth-sage border-growth-sage bg-growth-sage-soft">Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/5">Disabled</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                When disabled, demo cannot use AI Tutor, AI tests, or AI Assistant. Useful for demos where you don't want to consume AI quota.
              </p>
            </div>
            <Button
              onClick={toggleDemoAI}
              disabled={demoToggleSaving || isDemo}
              size="sm"
              variant={config.demo_ai_enabled ? "default" : "outline"}
              className={config.demo_ai_enabled ? "bg-emerald-600 text-white" : "border-border"}
              title={isDemo ? "Only administrators can change this setting" : undefined}
            >
              {demoToggleSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {config.demo_ai_enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          {!config.demo_ai_enabled && (
            <div className="mt-3 p-3 rounded-md bg-growth-amber-soft border border-growth-amber flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-growth-amber flex-shrink-0 mt-0.5" />
              <p className="text-xs text-growth-amber-foreground dark:text-growth-amber">
                Demo AI is currently disabled. The demo account will see "AI access for demo accounts is currently disabled" when trying to use any AI feature.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
