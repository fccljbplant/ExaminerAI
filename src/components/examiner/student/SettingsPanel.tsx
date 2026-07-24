"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AI_TIMEOUT_MS } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import { ThemePreferenceControl } from "@/components/examiner/student/ThemePreferenceControl";
import { ProjectSettingsCard } from "@/components/examiner/student/ProjectSettingsCard";
import { SecurityQuestionPanel } from "@/components/examiner/student/SecurityQuestionPanel";

export function SettingsPanel() {
  const [user, setUser] = useState<{ name: string; email: string; role: string; createdAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    api.get<{ user: { name: string; email: string; role: string; createdAt?: string } | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwMsg("");
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters"); return; }
    setPwBusy(true);
    try {
      // Verify current password by attempting login
      await api.post("/api/auth/login", { email: user?.email, password: currentPw });
      // If login succeeds, set new password via set-security-question pattern
      // We reuse the forgot-password reset endpoint with the security question flow
      // For a logged-in user, we can call a dedicated change endpoint
      await api.post("/api/auth/change-password", { currentPassword: currentPw, newPassword: newPw });
      setPwMsg("Password changed successfully!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setShowPwForm(false);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Account Info */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Account Information</CardTitle>
          <CardDescription className="text-muted-foreground">Your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
                <p className="text-foreground font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-foreground font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Role</p>
                <p className="text-foreground font-medium capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</p>
                <p className="text-foreground font-medium">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Security</CardTitle>
          <CardDescription className="text-muted-foreground">Change your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwMsg && (
            <Alert className="border-primary/30 bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary text-sm">{pwMsg}</AlertDescription>
            </Alert>
          )}
          {pwError && (
            <Alert className="border-destructive/30 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive text-sm">{pwError}</AlertDescription>
            </Alert>
          )}
          {!showPwForm ? (
            <Button variant="outline" onClick={() => setShowPwForm(true)} className="border-border">
              Change Password
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pw" className="text-foreground">Current Password</Label>
                <Input
                  id="current-pw"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw" className="text-foreground">New Password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="bg-background border-border text-foreground"
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw" className="text-foreground">Confirm New Password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={pwBusy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Password"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowPwForm(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Project Settings — rename or delete project */}
      <ProjectSettingsCard />

      {/* Security Question management — wires up the dead /api/auth/set-security-question route */}
      <SecurityQuestionPanel />

      {/* Theme Preference */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Appearance</CardTitle>
          <CardDescription className="text-muted-foreground">Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreferenceControl />
        </CardContent>
      </Card>
    </div>
  );
}
