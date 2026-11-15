"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/modules/ui/button";
import { Input } from "@/modules/ui/input";
import { Label } from "@/modules/ui/label";
import { Textarea } from "@/modules/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, CheckCircle2 } from "lucide-react";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your first teacher's name?",
  "What is your favorite programming language?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was your childhood nickname?",
  "What is the name of the street you grew up on?",
];

interface Props {
  onBack: () => void;
}

export default function ForgotPassword({ onBack }: Props) {
  const [step, setStep] = useState<"email" | "security" | "admin" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{
        ok: boolean;
        flow?: "security_question" | "admin_request";
        question?: string;
        message?: string;
      }>("/api/auth/forgot-password", { email, reason });
      if (res.flow === "security_question" && res.question) {
        setSecurityQuestion(res.question);
        setStep("security");
      } else if (res.flow === "admin_request") {
        setStep("admin");
      } else {
        // Generic response (email not found OR server chose not to disclose).
        // Show the server's actual message rather than the misleading "admin will
        // contact you" copy — the admin was NOT actually contacted in this branch.
        setSuccess(res.message || "If an account exists for that email, instructions have been sent.");
        setStep("done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [email, reason]);

  const submitSecurityAnswer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; message?: string; error?: string }>(
        "/api/auth/reset-password",
        { email, answer, newPassword }
      );
      setSuccess(res.message || "Password reset successfully!");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }, [email, answer, newPassword, confirmPassword]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-lg">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Forgot Password</h1>
        </div>

        <Card className="border-line bg-card text-fg shadow-sm">
          <CardHeader>
            <CardTitle className="text-fg flex items-center gap-2">
              {step === "email" && <>Reset your password</>}
              {step === "security" && <><ShieldCheck className="h-5 w-5 text-brand" /> Security Question</>}
              {step === "admin" && <><KeyRound className="h-5 w-5 text-brand" /> Request Admin Reset</>}
              {step === "done" && <><CheckCircle2 className="h-5 w-5 text-brand" /> Done</>}
            </CardTitle>
            <CardDescription className="text-fg-muted">
              {step === "email" && "Enter your email to begin the password reset process."}
              {step === "security" && "Answer your security question to set a new password."}
              {step === "admin" && "Your request has been sent to the administrator."}
              {step === "done" && "Your password has been reset."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-danger">{error}</p>}

            {/* Step 1: Email entry */}
            {step === "email" && (
              <form onSubmit={submitEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email" className="text-fg">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-surface border-line text-fg placeholder:text-fg-muted"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-reason" className="text-fg">Reason (optional)</Label>
                  <Textarea
                    id="fp-reason"
                    placeholder="Briefly explain why you need a reset (e.g., 'forgot my password')"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-surface border-line text-fg placeholder:text-fg-muted min-h-16"
                  />
                  <p className="text-xs text-fg-muted">
                    If you set a security question during signup, you&apos;ll be able to reset your password instantly.
                    Otherwise, an admin will review your request.
                  </p>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-brand hover:bg-brand-hover text-on-brand">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </Button>
                <Button type="button" variant="ghost" onClick={onBack} className="w-full text-fg-muted">
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </Button>
              </form>
            )}

            {/* Step 2: Security question */}
            {step === "security" && (
              <form onSubmit={submitSecurityAnswer} className="space-y-4">
                <div className="rounded-lg bg-bg-subtle/40 border border-line p-3">
                  <p className="text-xs text-fg-muted mb-1">Your security question:</p>
                  <p className="text-sm font-medium text-fg">{securityQuestion}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-answer" className="text-fg">Your answer</Label>
                  <Input
                    id="fp-answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="bg-surface border-line text-fg"
                    placeholder="Type your answer..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-newpw" className="text-fg">New password</Label>
                  <Input
                    id="fp-newpw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-surface border-line text-fg"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirmpw" className="text-fg">Confirm new password</Label>
                  <Input
                    id="fp-confirmpw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-surface border-line text-fg"
                    placeholder="Re-type your new password"
                    required
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-brand hover:bg-brand-hover text-on-brand">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep("email")} className="w-full text-fg-muted">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </form>
            )}

            {/* Step 3: Admin request submitted */}
            {step === "admin" && (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                <p className="text-sm text-fg">
                  Your password reset request has been sent to the administrator.
                  They will reset your password and share the temporary password with you.
                </p>
                <p className="text-xs text-fg-muted">
                  This typically happens within 24 hours. Contact your instructor if urgent.
                </p>
                <Button onClick={onBack} className="w-full bg-brand hover:bg-brand-hover text-on-brand">
                  Back to login
                </Button>
              </div>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                <p className="text-sm text-fg">{success}</p>
                <Button onClick={onBack} className="w-full bg-brand hover:bg-brand-hover text-on-brand">
                  Go to login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { SECURITY_QUESTIONS };
