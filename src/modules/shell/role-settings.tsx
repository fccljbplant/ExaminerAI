"use client";

/**
 * modules/shell — RoleSettings (2026-08-15)
 *
 * ONE user-settings page for every role (instructor, org admin,
 * platform admin — the learner has its richer Profile page). Avatar
 * upload, appearance/theme, and password change — the same experience
 * in every portal.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Palette, UserCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { AvatarEditor } from "@/modules/learner-portal";
import { ThemePackPicker } from "@/modules/theme";
import { Button } from "@/modules/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/card";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import { roleLabel } from "./user-menu";

interface MeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarData?: string | null;
}

export function RoleSettings({
  title,
  user,
}: {
  title: string;
  user: { name: string; email: string; role: string };
}) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // The avatar lives on the auth record — fetch it once for the editor.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: MeUser | null } | null) => {
        if (!cancelled && d?.user?.avatarData) setAvatar(d.user.avatarData);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">{title}</h1>
      <p className="text-sm text-fg-muted">
        {user.name} · {user.email} · {roleLabel(user.role)}
      </p>

      {/* Profile picture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="h-4 w-4" aria-hidden /> Profile picture
          </CardTitle>
          <CardDescription>
            Upload a photo — shown in the top bar, messages and on your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarEditor initial={avatar} onChange={(next) => setAvatar(next)} />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" aria-hidden /> Appearance
          </CardTitle>
          <CardDescription>
            Pick a theme pack — you can also switch quickly from the avatar menu on any device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePackPicker />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" aria-hidden /> Change password
          </CardTitle>
          <CardDescription>Use at least 6 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="max-w-md space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Current password</Label>
              <Input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-new">New password</Label>
              <Input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
