"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, KeyRound, Sparkles } from "lucide-react";
import ForgotPassword, { SECURITY_QUESTIONS } from "./ForgotPassword";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  currentWeek?: number;
  /** For guardians — the ID of the student they're linked to. */
  linkedStudentId?: string | null;
}

export default function Login({ onLoggedIn }: { onLoggedIn: (u: PublicUser) => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setBusy(true);
      try {
        if (tab === "login") {
          const res = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
          onLoggedIn(res.user);
        } else {
          await api.put("/api/auth/login", { name, email, password, securityQuestion, securityAnswer });
          try {
            const res = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
            onLoggedIn(res.user);
          } catch {
            setTab("login");
            setError("Account created — it's now pending approval. A teacher/admin must approve it before login.");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [tab, email, password, name, securityQuestion, securityAnswer, onLoggedIn]
  );

  if (showForgot) {
    return <ForgotPassword onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Examiner</h1>
          <p className="text-sm text-muted-foreground">
            Socratic assessments for the Modern Web Dev &amp; AI Bootcamp
          </p>
        </div>

        <Card className="border-border bg-card text-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Welcome back</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to access your dashboard, weekly tests, and AI tutor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* PROMINENT DEMO CTA */}
            <div className="mb-4 p-3 rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Try the Live Demo</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-2.5">
                One-click access. Explore every dashboard as admin, teacher, student, counsellor, principal.
              </p>
              <Button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  setError("");
                  setBusy(true);
                  try {
                    const res = await api.post<{ user: PublicUser }>("/api/auth/login", {
                      email: "demo@examiner.ai",
                      password: "demo123"
                    });
                    onLoggedIn(res.user);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Demo login failed");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {busy ? "Signing in…" : "Launch Demo (Demo Developer)"}
              </Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="w-full text-sm text-primary hover:underline flex items-center justify-center gap-1"
                  >
                    <KeyRound className="h-3 w-3" /> Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                      placeholder="Ada Lovelace"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-su" className="text-foreground">Email</Label>
                    <Input
                      id="email-su"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-su" className="text-foreground">Password</Label>
                    <Input
                      id="password-su"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                  {/* Security question for password recovery */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Security Question (for password recovery)
                    </Label>
                    <Select value={securityQuestion} onValueChange={setSecurityQuestion}>
                      <SelectTrigger className="bg-background border-border text-foreground">
                        <SelectValue placeholder="Choose a security question..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SECURITY_QUESTIONS.filter(q => q).map((q) => (
                          <SelectItem key={q} value={q}>{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {securityQuestion && (
                      <Input
                        type="text"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                        placeholder="Your answer (case-insensitive)"
                      />
                    )}
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
