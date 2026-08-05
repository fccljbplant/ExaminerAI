"use client";

/**
 * GuardianCreationPanel — staff UI for creating + removing guardian accounts.
 *
 * H6 fix (audit 2026-07-26): the guardian create/delete backend existed
 * (/api/guardian/create POST + DELETE) but there was NO UI for staff to use
 * it. Staff had to know the API existed and call it directly. This component
 * provides a simple form for:
 *   - Creating a guardian account linked to a specific student
 *   - Viewing the existing guardian (if any) for that student
 *   - Removing the guardian link + account
 *
 * Wired into StudentPortfolioPage so teachers/admins can manage guardians
 * directly from the student's portfolio view.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/lib/toast-helpers";
import {
  HeartHandshake, Loader2, UserPlus, Trash2, AlertCircle, CheckCircle2, Mail,
} from "lucide-react";

interface GuardianCreationPanelProps {
  studentId: string;
  studentName: string;
}

interface ExistingGuardian {
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  relationship: string;
}

export function GuardianCreationPanel({ studentId, studentName }: GuardianCreationPanelProps) {
  const [existing, setExisting] = useState<ExistingGuardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPassword, setGuardianPassword] = useState("");
  const [relationship, setRelationship] = useState("guardian");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch the student's user record to check for a guardian link
      // (the /api/users/[id] endpoint returns the guardian info if linked)
      const res = await api.get<{ user: { guardianLink?: ExistingGuardian | null } }>(`/api/users/${studentId}`).catch(() => null);
      // The user endpoint may not return guardianLink directly — try the guardian overview endpoint instead
      // which returns the guardian info if linked.
      if (res?.user?.guardianLink) {
        setExisting(res.user.guardianLink);
      } else {
        // Fallback: query the guardian overview endpoint (returns 200 with null guardian if none linked)
        try {
          const guardianRes = await api.get<{ guardian?: ExistingGuardian | null }>(`/api/guardian/overview?studentId=${studentId}`).catch(() => null);
          setExisting(guardianRes?.guardian ?? null);
        } catch {
          setExisting(null);
        }
      }
    } catch {
      setExisting(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!guardianName.trim() || !guardianEmail.trim() || !guardianPassword) {
      showError("All fields are required.");
      return;
    }
    if (guardianPassword.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ message: string; guardian: { id: string; name: string; email: string } }>("/api/guardian/create", {
        studentId,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim().toLowerCase(),
        guardianPassword,
        relationship,
      });
      showSuccess(res.message || `Guardian account created for ${res.guardian.name}.`);
      setGuardianName(""); setGuardianEmail(""); setGuardianPassword(""); setRelationship("guardian");
      setShowForm(false);
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create guardian account.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(`Remove the guardian account for ${existing.guardianName}? The guardian will no longer be able to view ${studentName}'s progress. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.del("/api/guardian/create", { guardianId: existing.guardianId });
      showSuccess("Guardian account removed.");
      setExisting(null);
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to remove guardian account.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading guardian info...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-primary" /> Guardian Access
            </CardTitle>
            <CardDescription className="text-xs">
              Create a parent/guardian account so they can view {studentName}&apos;s progress.
            </CardDescription>
          </div>
          {!existing && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
              <UserPlus className="h-3 w-3" /> Add Guardian
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing guardian */}
        {existing ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{existing.guardianName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Mail className="h-3 w-3" /> {existing.guardianEmail}
                </p>
                <Badge variant="outline" className="text-[9px] mt-1 capitalize">{existing.relationship}</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={remove}
                disabled={busy}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remove
              </Button>
            </div>
          </div>
        ) : showForm ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Guardian&apos;s full name *</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="e.g. John Smith" className="bg-background border-border h-8 text-xs mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Guardian&apos;s email *</Label>
              <Input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="parent@example.com" className="bg-background border-border h-8 text-xs mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Initial password *</Label>
              <Input type="password" value={guardianPassword} onChange={(e) => setGuardianPassword(e.target.value)} placeholder="At least 6 characters" className="bg-background border-border h-8 text-xs mt-0.5" />
              <p className="text-[9px] text-muted-foreground mt-0.5">The guardian can change this after their first login.</p>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Relationship to student</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className="bg-background border-border h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">Father</SelectItem>
                  <SelectItem value="mother">Mother</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={create} disabled={busy} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} Create Account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setGuardianName(""); setGuardianEmail(""); setGuardianPassword(""); }} className="h-7 text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No guardian linked to this student.</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click "Add Guardian" above to create one.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
