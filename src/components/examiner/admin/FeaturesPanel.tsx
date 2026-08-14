"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";

export function FeaturesPanel() {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ features: Record<string, boolean> }>("/api/settings/features").catch(() => ({ features: {} }));
      setFeatures(res.features || {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, value: boolean) => {
    setSaving(key);
    try {
      await api.post("/api/settings/features", { key, value });
      setFeatures({ ...features, [key]: value });
    } catch { /* ignore */ }
    finally { setSaving(null); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const featureList = [
    { key: "ai_enabled", label: "AI Questions & Evaluation", desc: "Allow students to get AI-generated questions and answer evaluations" },
    { key: "weekly_test_enabled", label: "Weekly Tests", desc: "Allow students to take the Socratic weekly test chatbot" },
    { key: "signup_enabled", label: "New Signups", desc: "Allow new users to create accounts" },
    { key: "ai_tutor_enabled", label: "AI Tutor", desc: "Show the AI Tutor tab to students and teachers" },
    { key: "messages_enabled", label: "Messaging", desc: "Allow students and teachers to send messages to each other" },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" /> Feature Control
        </CardTitle>
        <CardDescription className="text-muted-foreground">Enable or disable app features globally</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {featureList.map(f => {
          const enabled = features[f.key] !== false; // default to true
          return (
            <div key={f.key} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <Button
                onClick={() => toggle(f.key, !enabled)}
                disabled={saving === f.key}
                size="sm"
                variant={enabled ? "default" : "outline"}
                className={enabled ? "bg-emerald-600 text-white" : "border-border"}
              >
                {saving === f.key ? <Loader2 className="h-3 w-3 animate-spin" /> : enabled ? <CheckCircle2 className="h-3 w-3" /> : null}
                {enabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
