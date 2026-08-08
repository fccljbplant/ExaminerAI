"use client";

/**
 * SettingsPanel — unified settings page for ALL roles.
 *
 * H13 fix (audit 2026-07-26): the previous version of the Settings nav item
 * rendered <StudentDashboard initialMode="default" /> for EVERY role, which
 * meant teachers/admins/principals clicked "Settings" and saw the student
 * home view (confusing + wrong). This component is a proper settings page
 * that shows:
 *   - Profile info (name, email, role) — read-only
 *   - Theme preference (light/dark/system) — ThemePreferenceControl
 *   - Security question (set/update) — SecurityQuestionPanel
 *   - Change password — inline form
 *
 * All sections are role-agnostic — every authenticated user has a profile,
 * a theme preference, a security question (for self-service password reset),
 * and a password.
 */

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/toast-helpers";
import { ThemePreferenceControl } from "@/components/examiner/student/ThemePreferenceControl";
import { SecurityQuestionPanel } from "@/components/examiner/student/SecurityQuestionPanel";
import { Loader2, User, Palette, Shield, KeyRound, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

interface SettingsPanelProps {
  /** The current user's basic info — fetched from /api/auth/me by the parent. */
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    hasSecurityQuestion?: boolean;
  } | null;
}

export function SettingsPanel({ user }: SettingsPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Re-fetch user when the prop changes (e.g. after security question is set)
  useEffect(() => {
    // No-op — the parent passes the user, we just render.
  }, [user]);

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      showError("Current and new passwords are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      showError("New password must be at least 8 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      showSuccess("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 3000);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* ===== PROFILE ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
          <CardDescription className="text-xs">
            Your account information. Contact an administrator to change your name, email, or role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <span className="text-sm font-medium text-foreground">{user.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <span className="text-sm font-medium text-foreground">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Badge variant="outline" className="text-[10px] capitalize">{user.role.replace("_", " ")}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ===== THEME PREFERENCE ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
          <CardDescription className="text-xs">
            Choose how the interface looks. System follows your operating system setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreferenceControl />
        </CardContent>
      </Card>

      {/* ===== CHANGE PASSWORD ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
          <CardDescription className="text-xs">
            Use a strong, unique password. Minimum 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Current password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-background border-border"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background border-border"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Confirm new password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-background border-border"
              autoComplete="new-password"
              onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
            />
          </div>
          {passwordChanged && (
            <div className="rounded-md border border-growth-sage bg-growth-sage-soft p-2 text-xs text-growth-sage-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Password changed. Use your new password next time you sign in.
            </div>
          )}
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword.trim() || !newPassword.trim() || newPassword !== confirmPassword}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* ===== SECURITY QUESTION (for self-service password reset) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Security Question
          </CardTitle>
          <CardDescription className="text-xs">
            Used for self-service password reset if you forget yours. Set one if you haven&apos;t already.
            {!user.hasSecurityQuestion && (
              <span className="block mt-1 text-growth-amber dark:text-growth-amber">
                ⚠ No security question set — you won&apos;t be able to reset your password without an admin&apos;s help.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityQuestionPanel />
        </CardContent>
      </Card>
    </div>
  );
}
