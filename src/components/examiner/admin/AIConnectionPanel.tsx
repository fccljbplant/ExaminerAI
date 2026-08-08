"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, ShieldAlert, Loader2, Trash2, RefreshCw, Database, Key, Bug, Terminal,
  CheckCircle2, Zap, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, Send, BookOpen, Plus, Edit3, GraduationCap, ClipboardList,
  ShieldCheck, Save,
} from "lucide-react";

export function AIConnectionPanel() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; provider: string; response: string; durationMs: number; error?: string } | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [keyStatus, setKeyStatus] = useState("");

  const runTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await api.post<{ ok: boolean; provider: string; response: string; durationMs: number; error?: string }>("/api/ai/test", {});
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, provider: "error", response: "", durationMs: 0, error: e instanceof Error ? e.message : "Request failed" });
    } finally { setTesting(false); }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true); setKeyStatus("");
    try {
      const testRes = await api.post<{ ok: boolean; provider: string; error?: string }>("/api/ai/test", { apiKey: apiKey.trim() });
      if (!testRes.ok || testRes.provider !== "deepseek") {
        setKeyStatus(`⚠️ Key test failed: ${testRes.error || `Provider was ${testRes.provider}`}`);
        setSaving(false); return;
      }
      await api.post("/api/settings/ai-key", { apiKey: apiKey.trim() });
      setKeyStatus("✓ DeepSeek API key saved and verified. AI is now live.");
      setApiKey(""); setShowKeyInput(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setKeyStatus(`✗ ${e instanceof Error ? e.message : "Failed"}`); }
    finally { setSaving(false); }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base text-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> AI Connection</CardTitle>
        <CardDescription className="text-muted-foreground">Test the AI pipeline and configure the API key</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runTest} disabled={testing} size="sm" variant="outline" className="border-border">
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Test AI Now
        </Button>
        {testResult && (
          <div className={`rounded-md p-3 text-xs ${testResult.ok ? "bg-growth-sage-soft border border-growth-sage text-growth-sage-foreground" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
            <div className="flex items-center gap-2 mb-1">
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              <strong>{testResult.ok ? "AI is working" : "AI test failed"}</strong>
              <Badge variant="outline" className="ml-auto text-[10px]">{testResult.provider}</Badge>
              <span className="text-[10px] opacity-70">{testResult.durationMs}ms</span>
            </div>
            {testResult.response && <p className="font-mono text-[11px] mt-1 opacity-80">Response: &ldquo;{testResult.response.slice(0, 100)}&rdquo;</p>}
            {testResult.error && <p className="font-mono text-[11px] mt-1 opacity-80">Error: {testResult.error}</p>}
          </div>
        )}
        {showKeyInput && (
          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Configure DeepSeek API Key</p>
            <div className="flex gap-2">
              <Input type="password" placeholder="Paste your DeepSeek API key (sk-...)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="bg-muted border-border font-mono text-xs" />
              <Button onClick={saveKey} disabled={saving || !apiKey.trim()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Save &amp; Test
              </Button>
            </div>
            {keyStatus && <p className={`text-xs ${keyStatus.startsWith("✓") ? "text-growth-sage" : keyStatus.startsWith("⚠") ? "text-growth-amber" : "text-destructive"}`}>{keyStatus}</p>}
            <p className="text-[10px] text-muted-foreground">Get a key at <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="underline">DeepSeek Platform</a></p>
          </div>
        )}
        {!showKeyInput && <Button onClick={() => setShowKeyInput(true)} size="sm" variant="ghost" className="text-xs text-muted-foreground">Change API Key</Button>}
      </CardContent>
    </Card>
  );
}
