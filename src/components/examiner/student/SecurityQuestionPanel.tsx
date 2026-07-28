"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";

export function SecurityQuestionPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [hasQuestion, setHasQuestion] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch whether the user already has a security question set.
  // We don't expose the question text itself (privacy), just the boolean.
  useEffect(() => {
    api.get<{ user: { hasSecurityQuestion?: boolean } | null }>("/api/auth/me")
      .then((res) => {
        if (res.user?.hasSecurityQuestion) setHasQuestion(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMsg("");
    if (!question || !answer) { setError("Question and answer are required"); return; }
    if (answer.length < 2) { setError("Answer must be at least 2 characters"); return; }
    // If the user already has a question set, the server requires the current password.
    if (hasQuestion && !currentPw) {
      setError("Current password is required to update your existing security question");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/set-security-question", {
        question, answer, currentPassword: hasQuestion ? currentPw : undefined,
      });
      setMsg("Security question saved successfully!");
      setQuestion(""); setAnswer(""); setCurrentPw("");
      setHasQuestion(true);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Security Question</CardTitle>
        <CardDescription className="text-muted-foreground">
          {hasQuestion ? "Update your security question for password recovery (current password required)" : "Set a security question for self-service password recovery"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && <Alert className="border-primary/30 bg-primary/10"><CheckCircle2 className="h-4 w-4 text-primary" /><AlertDescription className="text-primary text-sm">{msg}</AlertDescription></Alert>}
        {error && <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle className="h-4 w-4 text-destructive" /><AlertDescription className="text-destructive text-sm">{error}</AlertDescription></Alert>}
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label className="text-foreground">Question</Label>
            <Select value={question} onValueChange={setQuestion}>
              <SelectTrigger className="bg-background border-border text-foreground"><SelectValue placeholder="Choose a security question..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="What was the name of your first pet?">What was the name of your first pet?</SelectItem>
                <SelectItem value="What city were you born in?">What city were you born in?</SelectItem>
                <SelectItem value="What was your first instructor's name?">What was your first instructor's name?</SelectItem>
                <SelectItem value="What is your favorite programming language?">What is your favorite programming language?</SelectItem>
                <SelectItem value="What was the name of your first school?">What was the name of your first school?</SelectItem>
                <SelectItem value="What is your mother's maiden name?">What is your mother's maiden name?</SelectItem>
                <SelectItem value="What was your childhood nickname?">What was your childhood nickname?</SelectItem>
                <SelectItem value="What is the name of the street you grew up on?">What is the name of the street you grew up on?</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Answer</Label>
            <Input value={answer} onChange={(e) => setAnswer(e.target.value)} className="bg-background border-border text-foreground" placeholder="Your answer (case-insensitive)" />
          </div>
          {hasQuestion && (
            <div className="space-y-2">
              <Label className="text-foreground">Current Password (required to update)</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="bg-background border-border text-foreground" placeholder="Enter your current password to confirm the change" />
            </div>
          )}
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasQuestion ? "Update Security Question" : "Save Security Question"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
