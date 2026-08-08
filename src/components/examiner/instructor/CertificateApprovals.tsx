"use client";

/**
 * CertificateApprovals — instructor/admin UI for reviewing + approving/rejecting
 * student certificate requests.
 *
 * C4 fix (audit 2026-07-26): the certificate request/approve backend was
 * wired (POST /api/certificates/generate handles both student-request and
 * staff-approve) but there was NO UI for staff to see pending requests and
 * act on them. Students could request, but nobody could approve from the
 * interface. This component fixes that.
 *
 * Lists all certificate requests with grade="PENDING" for batches the staff
 * member can access, with approve/reject buttons for each.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/toast-helpers";
import {
  Award, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink,
} from "lucide-react";

interface CertificateRequest {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  requestedAt: string;
  // Eligibility info — computed by the API so the instructor can see whether
  // the student has actually met the completion criteria before approving.
  completedTests: number;
  totalWeeks: number;
  avgScore: number | null;
  eligible: boolean;
  ineligibleReason?: string;
}

interface CertificateApprovalsProps {
  /** Optional callback when an approval/rejection happens — lets the parent
   *  refresh its own data (e.g. clear a notification badge). */
  onChanged?: () => void;
}

export function CertificateApprovals({ onChanged }: CertificateApprovalsProps) {
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // request ID being acted on
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // C4 fix: new /api/certificates/pending endpoint lists PENDING requests
      // for batches the staff member can access, plus computed eligibility info.
      const res = await api.get<{ requests: CertificateRequest[] }>("/api/certificates/pending");
      setRequests(res.requests || []);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to load certificate requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (req: CertificateRequest) => {
    setBusy(req.id);
    try {
      await api.post(`/api/certificates/generate?userId=${encodeURIComponent(req.userId)}`, {});
      showSuccess(`Certificate approved for ${req.studentName}.`);
      await load();
      onChanged?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to approve certificate");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (req: CertificateRequest) => {
    if (!rejectReason.trim()) {
      showError("Please provide a reason for rejecting the request.");
      return;
    }
    setBusy(req.id);
    try {
      await api.post(
        `/api/certificates/generate?userId=${encodeURIComponent(req.userId)}&reject=true`,
        { reason: rejectReason.trim() }
      );
      showSuccess(`Certificate request from ${req.studentName} rejected.`);
      setRejectingId(null);
      setRejectReason("");
      await load();
      onChanged?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to reject certificate");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-growth-amber" /> Certificate Approvals
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Review and approve student requests for completion certificates.
              Students must complete all weekly tests before they&apos;re eligible.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-7 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-10 w-10 text-growth-sage/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No pending requests</p>
            <p className="text-xs text-muted-foreground mt-1">
              When students request certificates, they&apos;ll appear here for your review.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {requests.map((req) => (
              <li key={req.id} className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{req.studentName}</p>
                      <Badge variant="outline" className="text-[9px]">{req.studentEmail}</Badge>
                      {req.eligible ? (
                        <Badge variant="outline" className="text-[9px] border-growth-sage bg-growth-sage-soft text-growth-sage-foreground">
                          Eligible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-growth-amber bg-growth-amber-soft text-growth-amber-foreground dark:text-growth-amber">
                          Not eligible
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Course: <span className="text-foreground">{req.courseName || "—"}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Requested {new Date(req.requestedAt).toLocaleDateString()}
                      {" · "}
                      {req.completedTests}/{req.totalWeeks} weekly tests completed
                      {req.avgScore !== null && ` · avg score ${req.avgScore}%`}
                    </p>
                    {!req.eligible && req.ineligibleReason && (
                      <p className="text-[10px] text-growth-amber dark:text-growth-amber mt-1">
                        ⚠ {req.ineligibleReason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => approve(req)}
                      disabled={busy === req.id || !req.eligible}
                      className="bg-growth-sage hover:bg-emerald-600 text-white h-7 text-xs"
                      title={req.eligible ? "Approve + issue certificate" : "Student is not eligible — ask them to complete all weekly tests first"}
                    >
                      {busy === req.id && rejectingId !== req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectingId(rejectingId === req.id ? null : req.id);
                        setRejectReason("");
                      }}
                      disabled={busy === req.id}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs"
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
                {rejectingId === req.id && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2 animate-fade-in-up">
                    <Label className="text-[10px] text-muted-foreground">Reason for rejection (visible to the student)</Label>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Please complete week 5 and 6 weekly tests before requesting your certificate."
                      className="bg-background border-border h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => reject(req)}
                        disabled={busy === req.id || !rejectReason.trim()}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-7 text-xs"
                      >
                        {busy === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        Confirm Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
